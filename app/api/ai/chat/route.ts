import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AIChatService, type AgentDecision } from '@/lib/services/ai-chat-service'
import { isValidUaPhone, normalizeUaPhone } from '@/lib/utils/phone'
import { getBusinessSnapshotText } from '@/lib/services/ai-snapshot'
import { runAiTool, type AiToolName } from '@/lib/services/ai-data-tools'

const DEFAULT_APPOINTMENT_DURATION_MINUTES = 60
const MAX_TOOL_CONTEXT_CHARS = 8000
const MAX_TOOL_LINE_CHARS = 1600
const MAX_TOOL_CALLS = 3
const MAX_ASSISTANT_REPLY_CHARS = 900

// Best-effort in-memory cooldown to avoid repeated 429 calls.
// Note: serverless instances may restart; this is still useful within a warm instance.
const aiCooldownByBusiness = new Map<string, number>()
const aiLastSuccessAtByBusiness = new Map<string, number>()
const AI_SUCCESS_TTL_MS = 10 * 60 * 1000

const parseJson = <T>(raw: string | null | undefined, fallback: T): T => {
  if (raw == null || String(raw).trim() === '') return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function parseDateTime(value: unknown): Date | null {
  if (typeof value === 'string' || typeof value === 'number') {
    const dt = new Date(value)
    return Number.isNaN(dt.getTime()) ? null : dt
  }
  return null
}

function toStartOfDay(value: Date): Date {
  const dt = new Date(value)
  dt.setHours(0, 0, 0, 0)
  return dt
}

function safeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, Math.max(0, max - 1)) + '…'
}

function parseRetryAfterMsFromAiError(message: string): number | null {
  const m1 = message.match(/Please retry in\s+([\d.]+)s/i)
  const s1 = m1 ? Number(m1[1]) : NaN
  if (Number.isFinite(s1) && s1 > 0) return Math.round(s1 * 1000)

  const m2 = message.match(/\"retryDelay\"\s*:\s*\"(\d+)s\"/i)
  const s2 = m2 ? Number(m2[1]) : NaN
  if (Number.isFinite(s2) && s2 > 0) return s2 * 1000

  return null
}

function buildToolContext(parts: string[]): string {
  if (parts.length === 0) return ''
  const snapshot = parts[0] || ''
  const rest = parts.slice(1).join('\n')
  const combined = rest ? `${snapshot}\n${rest}` : snapshot
  if (combined.length <= MAX_TOOL_CONTEXT_CHARS) return combined

  // Keep the beginning of snapshot + the newest tool outputs.
  const snapshotKeep = truncateText(snapshot, Math.min(2200, MAX_TOOL_CONTEXT_CHARS))
  const tailBudget = Math.max(0, MAX_TOOL_CONTEXT_CHARS - snapshotKeep.length - 20)
  const tail = combined.slice(-tailBudget)
  return `${snapshotKeep}\n...TRUNCATED...\n${tail}`
}

function containsAny(haystack: string, needles: string[]): boolean {
  const s = haystack.toLowerCase()
  return needles.some((n) => s.includes(n))
}

function parseDaysFromText(message: string, fallback: number): number {
  const m = message.toLowerCase()
  if (m.includes('сьогодні') || m.includes('today')) return 1
  if (m.includes('завтра') || m.includes('tomorrow')) return 2
  if (m.match(/\b7\b/) || m.includes('тиж')) return 7
  if (m.match(/\b30\b/) || m.includes('місяц')) return 30
  if (m.match(/\b90\b/) || m.includes('кварт') || m.includes('3 міся')) return 90
  return fallback
}

function parseLimitFromText(message: string, fallback: number, min = 1, max = 50): number {
  const m = message.toLowerCase()
  const match = m.match(/\b(?:top|топ|limit|ліміт|покажи|показати|останні)\s*(\d{1,3})\b/)
  const n = match ? parseInt(match[1] || '', 10) : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

function extractUaPhoneCandidate(message: string): string | null {
  const raw = message.replace(/[^\d+]/g, ' ')
  // Match +380XXXXXXXXX or 0XXXXXXXXX or 380XXXXXXXXX in rough text.
  const match = raw.match(/(?:\+?380\d{9}|380\d{9}|0\d{9})/)
  if (!match) return null
  const normalized = normalizeUaPhone(match[0])
  return isValidUaPhone(normalized) ? normalized : null
}

function extractSearchQuery(message: string): string | null {
  const s = message.trim()
  // Common patterns: "знайди клієнта Іван", "клієнт: Іван", "client Іван"
  const m1 = s.match(/(?:знайди|пошук|search)\s+(?:клієнт[аів]?|client[s]?)\s+(.+)$/i)
  if (m1?.[1]) return m1[1].trim()
  const m2 = s.match(/(?:клієнт[аів]?|client[s]?)\s*[:\-]\s*(.+)$/i)
  if (m2?.[1]) return m2[1].trim()
  return null
}

function formatMoneyUAH(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value || 0)
  if (!Number.isFinite(n)) return '0'
  // Keep it simple and ASCII; no Intl to avoid env differences.
  return String(Math.round(n))
}

async function tryHeuristicDataReply(params: {
  businessId: string
  message: string
  hasAiKey: boolean
}): Promise<{ reply: string; meta: Record<string, unknown> } | null> {
  const { businessId, message, hasAiKey } = params
  const m = message.toLowerCase()

  const wantsKpi = containsAny(m, ['kpi', 'аналіт', 'analytics', 'статист', 'показник', 'дохід', 'вируч'])
  const wantsPayments = containsAny(m, ['платеж', 'оплат', 'payments', 'revenue'])
  const wantsInbox = containsAny(m, ['інбокс', 'inbox', 'direct', 'соц', 'повідомл'])
  const wantsReminders = containsAny(m, ['нагад', 'reminder'])
  const wantsNotes = containsAny(m, ['нотат', 'замітк', 'note'])
  const wantsAppointments = containsAny(m, ['запис', 'appointments', 'календар', 'брон', 'броню', 'слот', 'сьогодні'])
  const wantsClients = containsAny(m, ['клієнт', 'clients', 'client', 'контакт'])
  const wantsSegments = containsAny(m, ['сегмент', 'segment'])
  const wantsOverview = containsAny(m, ['огляд', 'overview', 'що є в кабінеті', 'скільки клієн', 'скільки майстр', 'скільки послуг'])
  const wantsTopServices = containsAny(m, ['топ послуг', 'популярні послуг', 'services top', 'top services'])
  const wantsTopMasters = containsAny(m, ['топ майстр', 'популярні майстр', 'masters top', 'top masters'])
  const wantsAppointmentsList = containsAny(m, ['список запис', 'покажи запис', 'хто записан', 'найближч', 'записи на'])
  const wantsNotesList = containsAny(m, ['список нотат', 'покажи нотат'])
  const wantsRemindersList = containsAny(m, ['список нагад', 'покажи нагад'])
  const wantsInboxList = containsAny(m, ['покажи інбокс', 'останні повідомлення', 'останн', 'messages'])
  const wantsHelp = containsAny(m, [
    'що ти вмієш',
    'що вмієш',
    'команди',
    'help',
    'допомога',
    'як корист',
    'що можеш',
    'можливост',
  ])
  const isGreetingOnly =
    containsAny(m, ['привіт', 'hello', 'hi', 'добр', 'вітаю']) &&
    !wantsKpi &&
    !wantsPayments &&
    !wantsInbox &&
    !wantsReminders &&
    !wantsNotes &&
    !wantsAppointments

  // If this is a command-like message, let existing fallback handle it.
  if (message.trim().match(/^(?:note|нотатка|замітка|create note|reminder|нагадування|appointment|запис)\s*:/i)) {
    return null
  }

  if (isGreetingOnly) {
    return {
      reply:
        hasAiKey
          ? 'Привіт! Якщо AI тимчасово недоступний (квота/помилка) — я все одно можу показати цифри з кабінету.\nНапиши: "скільки записів сьогодні", "KPI за 7 днів", "payments за 30 днів", "інбокс unread".'
          : 'Привіт! AI ключ не підключений, але я можу показати дані з кабінету напряму.\nНапиши: "огляд кабінету", "скільки записів сьогодні", "payments за 30 днів", "інбокс unread".',
      meta: { mode: 'data_fallback', kind: hasAiKey ? 'help' : 'no_key_help' },
    }
  }

  if (wantsHelp) {
    return {
      reply:
        hasAiKey
          ? 'Я допомагаю по кабінету.\n\nШвидко можу: KPI/записи/клієнти/платежі/інбокс/нотатки/нагадування/сегменти/топ.\nПриклади: "KPI за 7 днів", "скільки записів сьогодні", "payments за 30 днів", "покажи інбокс", "знайди клієнта Іван".\n\nКоманди: "note: текст", "reminder: текст", "appointment: ...".'
          : 'Ключ не підключений (червоний індикатор), тому “розумні” відповіді обмежені. Але я можу тягнути дані з кабінету напряму.\nПриклади: "огляд кабінету", "скільки записів сьогодні", "payments за 30 днів", "покажи інбокс", "знайди клієнта Іван".\n\nКоманди: "note: текст", "reminder: текст", "appointment: ...".',
      meta: { mode: 'data_fallback', kind: hasAiKey ? 'help' : 'no_key_help' },
    }
  }

  if (
    !wantsKpi &&
    !wantsPayments &&
    !wantsInbox &&
    !wantsReminders &&
    !wantsNotes &&
    !wantsAppointments &&
    !wantsClients &&
    !wantsSegments &&
    !wantsOverview &&
    !wantsTopServices &&
    !wantsTopMasters &&
    !wantsAppointmentsList &&
    !wantsNotesList &&
    !wantsRemindersList &&
    !wantsInboxList
  ) {
    return null
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(startOfToday)
  endOfToday.setHours(23, 59, 59, 999)

  const parts: string[] = []
  const meta: Record<string, unknown> = { mode: 'data_fallback' }

  const opsPromise = Promise.allSettled([
    prisma.socialInboxMessage.count({ where: { businessId, isRead: false } }),
    prisma.telegramReminder.count({ where: { businessId, status: 'pending' } }),
    prisma.note.count({ where: { businessId, date: { gte: startOfToday, lte: endOfToday } } }),
  ]).then((results) => {
    const val = (idx: number): number | null => {
      const r = results[idx]
      return r && r.status === 'fulfilled' ? r.value : null
    }
    return { inboxUnread: val(0), remindersPending: val(1), notesToday: val(2) }
  })

  const toolCalls: Array<Promise<unknown>> = []
  let kpi7d: any = null
  let payments30d: any = null
  let appt7d: any = null
  let apptTodayCounts: any = null
  let overview: any = null
  let segments: any = null
  let notesList: any = null
  let remindersList: any = null
  let inboxSummary: any = null
  let apptList: any = null
  let servicesTop: any = null
  let mastersTop: any = null
  let clientsSearch: any = null
  let clientByPhone: any = null
  let clientHistory: any = null

  const days = parseDaysFromText(message, 7)
  const limit = parseLimitFromText(message, 10)
  const phone = extractUaPhoneCandidate(message)
  const q = extractSearchQuery(message)
  const wantsClientHistory = containsAny(m, ['істор', 'history', 'візит', 'відвідуван', 'скільки витратив'])

  if (wantsKpi) {
    toolCalls.push(
      runAiTool(businessId, 'analytics_kpi', { days: 7 }).then((r) => {
        kpi7d = r
      })
    )
  }
  if (wantsPayments) {
    toolCalls.push(
      runAiTool(businessId, 'payments_kpi', { days: 30 }).then((r) => {
        payments30d = r
      })
    )
  }

  if (wantsAppointments) {
    toolCalls.push(
      runAiTool(businessId, 'appointments_stats', { days: 7 }).then((r) => {
        appt7d = r
      })
    )
    toolCalls.push(
      prisma.appointment
        .groupBy({
          by: ['status'],
          where: { businessId, startTime: { gte: startOfToday, lte: endOfToday } },
          _count: { _all: true },
        })
        .then((rows) => {
          apptTodayCounts = rows
        })
    )
  }

  if (wantsOverview) {
    toolCalls.push(
      runAiTool(businessId, 'biz_overview', {}).then((r) => {
        overview = r
      })
    )
  }

  if (wantsSegments) {
    toolCalls.push(
      runAiTool(businessId, 'segments_list', {}).then((r) => {
        segments = r
      })
    )
  }

  if (wantsNotesList) {
    const todayIso = new Date().toISOString().slice(0, 10)
    const date = containsAny(m, ['сьогодні', 'today']) ? todayIso : undefined
    toolCalls.push(
      runAiTool(businessId, 'notes_list', { date, limit }).then((r) => {
        notesList = r
      })
    )
  }

  if (wantsRemindersList) {
    const status = containsAny(m, ['pending', 'в очіку', 'не відправ', 'активн']) ? 'pending' : undefined
    toolCalls.push(
      runAiTool(businessId, 'reminders_list', { status, limit }).then((r) => {
        remindersList = r
      })
    )
  }

  if (wantsInboxList || (wantsInbox && containsAny(m, ['покажи', 'останні', 'last']))) {
    const platform = containsAny(m, ['instagram', 'інст', 'insta']) ? 'instagram' : containsAny(m, ['facebook', 'фейс']) ? 'facebook' : undefined
    toolCalls.push(
      runAiTool(businessId, 'social_inbox_summary', { platform, limit }).then((r) => {
        inboxSummary = r
      })
    )
  }

  if (wantsAppointmentsList) {
    toolCalls.push(
      runAiTool(businessId, 'appointments_list', { days, limit }).then((r) => {
        apptList = r
      })
    )
  }

  if (wantsTopServices) {
    toolCalls.push(
      runAiTool(businessId, 'services_top', { days: parseDaysFromText(message, 30), limit: Math.min(10, Math.max(1, limit)) }).then((r) => {
        servicesTop = r
      })
    )
  }
  if (wantsTopMasters) {
    toolCalls.push(
      runAiTool(businessId, 'masters_top', { days: parseDaysFromText(message, 30), limit: Math.min(10, Math.max(1, limit)) }).then((r) => {
        mastersTop = r
      })
    )
  }

  if (wantsClients) {
    if (phone) {
      toolCalls.push(
        runAiTool(businessId, 'client_by_phone', { phone }).then((r) => {
          clientByPhone = r
        })
      )
      // If they asked history - fetch it in a second step after we know clientId (below).
    } else if (q) {
      toolCalls.push(
        runAiTool(businessId, 'clients_search', { q, limit: Math.min(20, Math.max(1, limit)) }).then((r) => {
          clientsSearch = r
        })
      )
    }
  }

  const [ops] = await Promise.all([opsPromise, Promise.allSettled(toolCalls)])

  if (wantsInbox || wantsReminders || wantsNotes || wantsOverview) {
    parts.push(
      `Оперативно: inbox unread=${ops.inboxUnread ?? 'n/a'}, reminders pending=${ops.remindersPending ?? 'n/a'}, notes today=${ops.notesToday ?? 'n/a'}.`
    )
    meta.ops = ops
  }

  if (wantsKpi && kpi7d && typeof kpi7d === 'object') {
    const data = (kpi7d as any).data || (kpi7d as any)
    const kpi = (data && typeof data === 'object' && (data as any).kpi) ? (data as any).kpi : data
    parts.push(
      `KPI 7д: записів=${kpi?.appointmentsTotal ?? 0}, виконано=${kpi?.appointmentsDone ?? 0}, скасовано=${kpi?.cancelled ?? 0}, нових клієнтів=${kpi?.newClients ?? 0}.`
    )
    parts.push(`Дохід (succeeded)=${formatMoneyUAH(kpi?.revenue ?? 0)}; платежів=${kpi?.paymentsCount ?? 0}.`)
    meta.kpi7d = kpi
  }

  if (wantsPayments && payments30d && typeof payments30d === 'object') {
    const data = (payments30d as any).data || (payments30d as any)
    const rows = Array.isArray(data.byStatus) ? data.byStatus : []
    const fmt = (s: any) => `${s.status}:${s.count}/${formatMoneyUAH(s.sum)}`
    parts.push(`Payments 30д: ${rows.map(fmt).join(', ') || 'немає'}.`)
    meta.payments30d = data
  }

  if (wantsAppointments) {
    const todayRows = Array.isArray(apptTodayCounts) ? apptTodayCounts : []
    const todayTotal = todayRows.reduce((sum: number, r: any) => sum + (r?._count?._all || 0), 0)
    const fmtRow = (r: any) => `${r.status}:${r._count?._all || 0}`
    parts.push(`Записи сьогодні: ${todayTotal} (${todayRows.map(fmtRow).join(', ') || '0'}).`)
    meta.appointmentsToday = { total: todayTotal, byStatus: todayRows.map((r: any) => ({ status: r.status, count: r._count?._all || 0 })) }

    if (appt7d && typeof appt7d === 'object') {
      const data = (appt7d as any).data || (appt7d as any)
      const byStatus = Array.isArray(data.byStatus) ? data.byStatus : []
      const total7d = byStatus.reduce((sum: number, r: any) => sum + (r?.count || 0), 0)
      parts.push(`Записи за 7 днів: ${total7d} (${byStatus.map((r: any) => `${r.status}:${r.count}`).join(', ') || '0'}).`)
      meta.appointments7d = data
    }
  }

  if (wantsOverview && overview && typeof overview === 'object') {
    const data = (overview as any).data || (overview as any)
    const counts = (data && typeof data === 'object') ? (data as any).counts : null
    const biz = (data && typeof data === 'object') ? (data as any).business : null
    if (biz) parts.push(`Бізнес: ${biz.name || 'n/a'}; AI chat=${biz.aiChatEnabled ? 'ON' : 'OFF'}; reminders=${biz.remindersEnabled ? 'ON' : 'OFF'}.`)
    if (counts) parts.push(`Лічильники: клієнтів=${counts.clients ?? 'n/a'}, майстрів=${counts.masters ?? 'n/a'}, послуг=${counts.services ?? 'n/a'}, записів=${counts.appointments ?? 'n/a'}.`)
    meta.overview = data
  }

  if (wantsSegments && segments && typeof segments === 'object') {
    const data = (segments as any).data || (segments as any)
    const rows = Array.isArray(data.rows) ? data.rows : []
    parts.push(`Сегменти: ${rows.length ? rows.map((r: any) => `${r.name}(${r.clientCount ?? 0})`).join(', ') : 'немає'}.`)
    meta.segments = data
  }

  if (wantsNotesList && notesList && typeof notesList === 'object') {
    const data = (notesList as any).data || (notesList as any)
    const rows = Array.isArray(data.rows) ? data.rows : []
    parts.push(`Нотатки${data.date ? ` (${data.date})` : ''}: ${rows.length ? rows.map((r: any) => `${r.completed ? '[x]' : '[ ]'} ${r.text}`).join('\n') : 'немає'}.`)
    meta.notesList = data
  }

  if (wantsRemindersList && remindersList && typeof remindersList === 'object') {
    const data = (remindersList as any).data || (remindersList as any)
    const rows = Array.isArray(data.rows) ? data.rows : []
    parts.push(`Нагадування${data.status ? ` (${data.status})` : ''}: ${rows.length ? rows.map((r: any) => `${r.status} ${r.scheduledAt ? `@${String(r.scheduledAt)}` : ''} - ${r.message}`).join('\n') : 'немає'}.`)
    meta.remindersList = data
  }

  if ((wantsInboxList || wantsInbox) && inboxSummary && typeof inboxSummary === 'object') {
    const data = (inboxSummary as any).data || (inboxSummary as any)
    const rows = Array.isArray(data.rows) ? data.rows : []
    parts.push(`Інбокс: unread=${data.unreadCount ?? 'n/a'}. Останні: ${rows.length ? rows.map((r: any) => `${r.platform}:${r.unread ? 'unread' : 'read'} ${r.sender || 'n/a'} - ${r.preview}`).join('\n') : 'немає'}.`)
    meta.inbox = data
  }

  if (wantsAppointmentsList && apptList && typeof apptList === 'object') {
    const data = (apptList as any).data || (apptList as any)
    const rows = Array.isArray(data.rows) ? data.rows : []
    parts.push(`Записи (до ${data.limit ?? limit} за ${days} дн): ${rows.length ? rows.map((r: any) => `${String(r.start)} ${r.status} ${r.client || ''} (*${r.phoneLast4 || ''})`).join('\n') : 'немає'}.`)
    meta.appointmentsList = data
  }

  if (wantsTopServices && servicesTop && typeof servicesTop === 'object') {
    const data = (servicesTop as any).data || (servicesTop as any)
    const rows = Array.isArray(data.rows) ? data.rows : []
    parts.push(`Топ послуг (${parseDaysFromText(message, 30)}д): ${rows.length ? rows.map((r: any) => `${r.name || r.serviceId}:${r.count}`).join(', ') : 'немає'}.`)
    meta.servicesTop = data
  }
  if (wantsTopMasters && mastersTop && typeof mastersTop === 'object') {
    const data = (mastersTop as any).data || (mastersTop as any)
    const rows = Array.isArray(data.rows) ? data.rows : []
    parts.push(`Топ майстрів (${parseDaysFromText(message, 30)}д): ${rows.length ? rows.map((r: any) => `${r.masterName || r.masterId}:${r.appointments}`).join(', ') : 'немає'}.`)
    meta.mastersTop = data
  }

  // Client reply: search/by phone, plus history if requested.
  if (wantsClients) {
    if (phone && clientByPhone && typeof clientByPhone === 'object') {
      const data = (clientByPhone as any).data || (clientByPhone as any)
      const client = data.client || null
      if (!client) {
        parts.push(`Клієнт за телефоном ${phone} не знайдений.`)
      } else {
        parts.push(
          `Клієнт: ${client.name} (*${client.phoneLast4}), статус=${client.status || 'n/a'}, візитів=${client.totalAppointments ?? 0}, витрати=${formatMoneyUAH(client.totalSpent ?? 0)}.`
        )
        meta.client = client

        if (wantsClientHistory && client.id) {
          try {
            const hist = await runAiTool(businessId, 'client_history', { clientId: client.id, limit: Math.min(10, Math.max(1, limit)) })
            const hdata = (hist as any).data || (hist as any)
            const appts = Array.isArray(hdata.appointments) ? hdata.appointments : []
            parts.push(
              `Історія (останні ${appts.length}): ${appts.length ? appts.map((a: any) => `${String(a.start)} ${a.status} (masterId=${a.masterId})`).join('\n') : 'немає'}.`
            )
            meta.clientHistory = hdata
          } catch {
            // ignore; keep partial response
          }
        } else if (containsAny(m, ['істор', 'history'])) {
          parts.push('Щоб показати історію, напиши: "історія клієнта +380..."')
        }
      }
    } else if (q && clientsSearch && typeof clientsSearch === 'object') {
      const data = (clientsSearch as any).data || (clientsSearch as any)
      const rows = Array.isArray(data.rows) ? data.rows : []
      parts.push(`Клієнти за "${data.q || q}": ${rows.length ? rows.map((c: any) => `${c.name} (*${c.phoneLast4})`).join(', ') : 'немає'}.`)
      meta.clients = data
    } else if (!phone && !q) {
      parts.push('Щоб знайти клієнта — напиши ім’я або телефон: "знайди клієнта Іван" або "клієнт +380..."')
    }
  }

  if (parts.length === 0) return null

  parts.push('Можу деталізувати: скажи період (1/7/30/90) і що саме показати.')
  return { reply: parts.join('\n'), meta }
}

function buildFallbackDecision(
  message: string,
  business: {
    services: Array<{ id: string; name: string; duration: number }>
  }
): AgentDecision {
  const raw = message.trim()
  const lower = raw.toLowerCase()

  const noteMatch = raw.match(/^(?:note|нотатка|замітка|create note)\s*:\s*(.+)$/i)
  if (noteMatch?.[1]) {
    return {
      action: 'create_note',
      reply: 'Готово, створюю нотатку.',
      confidence: 0.7,
      payload: { text: noteMatch[1].trim() },
    }
  }

  const reminderMatch = raw.match(/^(?:reminder|нагадування)\s*:\s*(.+)$/i)
  if (reminderMatch?.[1]) {
    return {
      action: 'create_reminder',
      reply: 'Готово, створюю нагадування.',
      confidence: 0.7,
      payload: { message: reminderMatch[1].trim(), targetType: 'all' },
    }
  }

  const appointmentMatch = raw.match(
    /^(?:appointment|запис)\s*:\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?:,\s*(.+))?$/i
  )
  if (appointmentMatch) {
    const clientName = appointmentMatch[1].trim()
    const clientPhone = appointmentMatch[2].trim()
    const masterName = appointmentMatch[3].trim()
    const startTime = appointmentMatch[4].trim()
    const serviceName = appointmentMatch[5]?.trim()
    const serviceId = serviceName
      ? business.services.find((s) => s.name.toLowerCase().includes(serviceName.toLowerCase()))?.id
      : undefined

    return {
      action: 'create_appointment',
      reply: 'Готово, створюю запис.',
      confidence: 0.7,
      payload: {
        clientName,
        clientPhone,
        masterName,
        startTime,
        serviceIds: serviceId ? [serviceId] : [],
      },
    }
  }

  if (lower.includes('help') || lower.includes('допом')) {
    return {
      action: 'reply',
      reply:
        'Формати fallback-команд: note: текст; reminder: текст; appointment: Імʼя, +380..., Майстер, 2026-02-16T15:00, Послуга.',
      confidence: 1,
    }
  }

  return {
    action: 'reply',
    reply:
      'AI тимчасово недоступний. Спробуйте: note: ..., reminder: ..., appointment: Імʼя, +380..., Майстер, 2026-02-16T15:00.',
    confidence: 0.2,
  }
}

async function executeAgentAction(params: {
  businessId: string
  message: string
  business: {
    services: Array<{ id: string; name: string; duration: number }>
    masters: Array<{ id: string; name: string }>
  }
  decision: AgentDecision
}): Promise<{ message: string; actionData: Record<string, unknown> | null }> {
  const { businessId, message, business, decision } = params
  const payload = decision.payload || {}

  if (decision.action === 'create_note') {
    let noteText = safeText(payload.text) || safeText(message)
    if (noteText) {
      noteText = noteText.replace(/^(?:note|нотатка|замітка)\s*:\s*/i, '').trim()
    }
    if (!noteText) {
      return {
        message: 'Щоб створити нотатку, напишіть її текст.',
        actionData: { action: 'create_note', status: 'missing_fields', missing: ['text'] },
      }
    }

    const parsedDate = parseDateTime(payload.date)
    const note = await prisma.note.create({
      data: {
        businessId,
        text: noteText,
        date: toStartOfDay(parsedDate || new Date()),
        order: typeof payload.order === 'number' ? payload.order : 0,
      },
      select: { id: true, text: true, date: true, order: true },
    })

    return {
      message: decision.reply || 'Готово, нотатку створено.',
      actionData: { action: 'create_note', status: 'completed', note },
    }
  }

  if (decision.action === 'create_reminder') {
    const reminderMessage = safeText(payload.message) || safeText(message)
    if (!reminderMessage) {
      return {
        message: 'Щоб створити нагадування, потрібен текст нагадування.',
        actionData: { action: 'create_reminder', status: 'missing_fields', missing: ['message'] },
      }
    }

    const targetTypeRaw = safeText(payload.targetType)
    let targetType: 'all' | 'client' = targetTypeRaw === 'client' ? 'client' : 'all'
    let clientId: string | null = null

    const clientPhone = safeText(payload.clientPhone)
    if (clientPhone) {
      const normalizedPhone = normalizeUaPhone(clientPhone)
      const client = await prisma.client.findUnique({
        where: { businessId_phone: { businessId, phone: normalizedPhone } },
        select: { id: true },
      })
      if (client) {
        targetType = 'client'
        clientId = client.id
      }
    }

    if (targetType === 'client' && !clientId) {
      return {
        message: 'Для персонального нагадування потрібен валідний телефон клієнта, який є у базі.',
        actionData: { action: 'create_reminder', status: 'missing_fields', missing: ['clientPhone'] },
      }
    }

    const scheduledAt = parseDateTime(payload.scheduledAt)
    const reminder = await prisma.telegramReminder.create({
      data: {
        businessId,
        message: reminderMessage,
        targetType,
        clientId,
        scheduledAt,
        status: 'pending',
        createdBy: 'ai-agent',
      },
      select: { id: true, targetType: true, scheduledAt: true, status: true },
    })

    return {
      message: decision.reply || 'Готово, нагадування створено.',
      actionData: { action: 'create_reminder', status: 'completed', reminder },
    }
  }

  if (decision.action === 'create_appointment') {
    const payloadMasterId = safeText(payload.masterId)
    const payloadMasterName = safeText(payload.masterName)?.toLowerCase()
    const master = business.masters.find((m) => {
      if (payloadMasterId && m.id === payloadMasterId) return true
      if (payloadMasterName && (m.name.toLowerCase().includes(payloadMasterName) || m.id === payloadMasterName)) return true
      return false
    })

    const clientName = safeText(payload.clientName)
    const clientPhoneRaw = safeText(payload.clientPhone)
    const startTime = parseDateTime(payload.startTime || payload.dateTime)
    if (!master || !clientName || !clientPhoneRaw || !startTime) {
      return {
        message:
          decision.reply ||
          'Для створення запису потрібні: майстер, ім’я клієнта, телефон і час початку.',
        actionData: {
          action: 'create_appointment',
          status: 'missing_fields',
          missing: [
            !master ? 'masterId/masterName' : null,
            !clientName ? 'clientName' : null,
            !clientPhoneRaw ? 'clientPhone' : null,
            !startTime ? 'startTime' : null,
          ].filter(Boolean),
        },
      }
    }

    const clientPhone = normalizeUaPhone(clientPhoneRaw)
    if (!isValidUaPhone(clientPhone)) {
      return {
        message: 'Телефон клієнта некоректний. Вкажіть український номер, наприклад 0671234567.',
        actionData: { action: 'create_appointment', status: 'invalid_phone' },
      }
    }

    const serviceIds = Array.isArray(payload.serviceIds)
      ? payload.serviceIds.filter((s): s is string => typeof s === 'string')
      : []
    const validServiceIds = serviceIds.filter((id) => business.services.some((s) => s.id === id))
    const selectedService = validServiceIds.length > 0
      ? business.services.find((s) => s.id === validServiceIds[0])
      : undefined
    const durationFromPayload =
      typeof payload.durationMinutes === 'number' && payload.durationMinutes > 0
        ? payload.durationMinutes
        : null
    const durationMinutes =
      durationFromPayload || selectedService?.duration || DEFAULT_APPOINTMENT_DURATION_MINUTES
    const endTime = parseDateTime(payload.endTime) || new Date(startTime.getTime() + durationMinutes * 60 * 1000)

    const hasConflict = await prisma.appointment.findFirst({
      where: {
        businessId,
        masterId: master.id,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        status: { notIn: ['Cancelled', 'Скасовано'] },
      },
      select: { id: true },
    })
    if (hasConflict) {
      return {
        message: 'Цей час уже зайнятий. Напишіть інший час, і я запропоную вільні слоти.',
        actionData: { action: 'create_appointment', status: 'time_conflict' },
      }
    }

    const ensuredClient = await prisma.client.upsert({
      where: { businessId_phone: { businessId, phone: clientPhone } },
      create: {
        businessId,
        name: clientName,
        phone: clientPhone,
        email: safeText(payload.clientEmail),
      },
      update: {
        name: clientName,
        ...(safeText(payload.clientEmail) ? { email: safeText(payload.clientEmail) } : {}),
      },
      select: { id: true },
    })

    const appointment = await prisma.appointment.create({
      data: {
        businessId,
        masterId: master.id,
        clientId: ensuredClient.id,
        clientName,
        clientPhone,
        clientEmail: safeText(payload.clientEmail),
        startTime,
        endTime,
        status: 'Confirmed',
        services: JSON.stringify(validServiceIds),
        notes: safeText(payload.notes),
        customServiceName: safeText(payload.customServiceName),
        customPrice: typeof payload.customPrice === 'number' ? payload.customPrice : null,
        isFromBooking: false,
        source: 'ai_agent',
      },
      select: { id: true, startTime: true, endTime: true, masterId: true, status: true },
    })

    return {
      message: decision.reply || 'Готово, запис створено.',
      actionData: { action: 'create_appointment', status: 'completed', appointment },
    }
  }

  return {
    message: decision.reply || 'Готово.',
    actionData: { action: 'reply', status: 'completed' },
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, message, sessionId } = body
    const globalAiApiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()

    if (!businessId || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        services: { where: { isActive: true } },
        masters: { where: { isActive: true } },
      },
    })
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const hasAiKey = !!((business.aiApiKey?.trim() || globalAiApiKey || '').trim())
    if (!business.aiChatEnabled) {
      // Don't fail hard: the widget is visible in dashboard for most users.
      // Return a user-facing message so the UI doesn't show a generic error.
      return NextResponse.json({
        success: true,
        message:
          'AI чат вимкнений для цього акаунта. Увімкнути/вимкнути AI можна тільки в Центрі управління (адмін).',
        action: { action: 'reply', status: 'ai_disabled' },
        ai: {
          hasKey: hasAiKey,
          indicator: 'red',
          usedAi: false,
          reason: 'ai_disabled',
        },
      })
    }

    const effectiveApiKey = business.aiApiKey?.trim() || globalAiApiKey || null
    const chatHistory = await prisma.aIChatMessage.findMany({
      where: { businessId, sessionId: sessionId || 'default' },
      orderBy: { createdAt: 'asc' },
      take: 10,
    })

    const context = {
      businessName: business.name,
      businessDescription: business.description || undefined,
      services: business.services.map((s) => ({
        name: s.name,
        price: s.price,
        duration: s.duration,
      })),
      masters: business.masters.map((m) => ({
        name: m.name,
        bio: m.bio || undefined,
      })),
      workingHours: parseJson(business.workingHours, undefined),
      location: business.location || undefined,
    }

    const history = chatHistory.map((msg) => ({ role: msg.role, message: msg.message }))
    const aiSettings = parseJson<{ model?: string }>(business.aiSettings, {})
    const aiService = effectiveApiKey
      ? new AIChatService(effectiveApiKey, aiSettings.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash')
      : null
    const isKeyMissing = !effectiveApiKey

    let decision: AgentDecision | null = null
    let aiUnavailableReason: string | null = null
    let usedAi = false
    let decisionSource: 'llm' | 'heuristic' | 'fallback' | null = null
    const snapshotText = await getBusinessSnapshotText(businessId)
    const toolContextParts: string[] = [snapshotText]

    const now = Date.now()
    const cooldownUntil = aiCooldownByBusiness.get(businessId) || 0

    if (aiService && now < cooldownUntil) {
      aiUnavailableReason = `AI rate-limited (cooldown ${Math.ceil((cooldownUntil - now) / 1000)}s)`
      decision = null
    } else if (aiService) {
      try {
        let toolCalls = 0
        while (toolCalls < MAX_TOOL_CALLS) {
          decision = await aiService.getAgentDecision(message, context, history, buildToolContext(toolContextParts))
          if (!decision || decision.action !== 'tool_call' || !decision.tool?.name) break

          const name = decision.tool.name as AiToolName
          const result = await runAiTool(businessId, name, decision.tool.args)
          const line = `TOOL:${result.tool}=${JSON.stringify(result.data)}`
          toolContextParts.push(truncateText(line, MAX_TOOL_LINE_CHARS))
          toolCalls++
        }

        // Ensure we always end with a user-facing reply, even if tool-call limit was reached.
        if (decision?.action === 'tool_call') {
          toolContextParts.push('TOOL_LIMIT_REACHED=true; now reply using existing TOOL_CONTEXT, no more tool_call.')
          decision = await aiService.getAgentDecision(message, context, history, buildToolContext(toolContextParts))
        }

        if (decision) {
          usedAi = true
          decisionSource = 'llm'
          aiLastSuccessAtByBusiness.set(businessId, Date.now())
        }
      } catch (error) {
        aiUnavailableReason = error instanceof Error ? error.message : 'AI unavailable'
        decision = null

        // If provider returns retry-after info, set a cooldown to avoid repeated failing calls.
        if (aiUnavailableReason && aiUnavailableReason.includes('429')) {
          const retryMs = parseRetryAfterMsFromAiError(aiUnavailableReason) ?? 30000
          const safeRetryMs = Math.max(5000, Math.min(5 * 60 * 1000, retryMs))
          aiCooldownByBusiness.set(businessId, Date.now() + safeRetryMs)
        }
      }
    } else {
      aiUnavailableReason = 'AI API key is not configured'
    }

    if (!decision) {
      // If LLM is rate-limited/misconfigured, still answer common "dashboard" questions via direct DB/tools.
      const heuristic = await tryHeuristicDataReply({ businessId, message, hasAiKey: !!effectiveApiKey })
      if (heuristic) {
        decision = {
          action: 'reply',
          reply: heuristic.reply,
          confidence: 0.65,
          payload: { ...heuristic.meta },
        }
        decisionSource = 'heuristic'
      }
    }

    if (!decision && isKeyMissing) {
      // No key configured: don't reply with a generic "AI unavailable".
      // Provide a "cabinet assistant" menu so user can keep working.
      decision = {
        action: 'reply',
        reply:
          'AI ключ не підключений, тому "розумні" відповіді можуть бути обмежені. Але я можу напряму з кабінету показати дані:\n' +
          '- "огляд кабінету" (клієнти/майстри/послуги/записи)\n' +
          '- "KPI за 7 днів"\n' +
          '- "payments за 30 днів"\n' +
          '- "скільки записів сьогодні" або "покажи записи на 7 днів"\n' +
          '- "інбокс unread" або "покажи інбокс"\n' +
          '- "покажи нотатки сьогодні", "нагадування pending"\n' +
          '- "знайди клієнта Іван", "клієнт +380...", "історія клієнта +380..."\n' +
          '- "покажи сегменти"\n' +
          '- "топ послуг за 30 днів", "топ майстрів за 30 днів"\n\n' +
          'Напиши, що саме потрібно — і я витягну це з бази.',
        confidence: 1,
        payload: { mode: 'no_key_fallback' },
      }
      decisionSource = 'heuristic'
    }

    if (!decision) {
      decision = buildFallbackDecision(message, {
        services: business.services.map((s) => ({ id: s.id, name: s.name, duration: s.duration })),
      })
      decisionSource = 'fallback'
    }

    let assistantMessage = ''
    let tokens: number | undefined
    let actionData: Record<string, unknown> | null = null

    if (decision.action !== 'reply') {
      const actionResult = await executeAgentAction({
        businessId,
        message,
        business: {
          services: business.services.map((s) => ({ id: s.id, name: s.name, duration: s.duration })),
          masters: business.masters.map((m) => ({ id: m.id, name: m.name })),
        },
        decision,
      })
      assistantMessage = actionResult.message
      actionData = actionResult.actionData
    } else {
      // IMPORTANT: for "reply" we trust agent-decision. Do not overwrite with getResponse(),
      // otherwise the model will ignore tools/snapshot and switch to generic "client assistant" mode.
      assistantMessage = decision.reply || 'Ок. Що саме показати: KPI, записи, клієнтів/сегменти, платежі, нотатки або інбокс?'
      actionData = { action: 'reply', status: 'completed', confidence: decision.confidence }
    }

    if (aiUnavailableReason) {
      actionData = {
        ...(actionData || {}),
        mode: 'heuristic_fallback',
        aiUnavailableReason,
      }
    }

    if (!assistantMessage.trim()) {
      assistantMessage = 'Не вдалося обробити запит. Спробуйте ще раз.'
    }

    // Keep responses compact to reduce token usage and keep the chat snappy.
    assistantMessage = truncateText(assistantMessage.trim(), MAX_ASSISTANT_REPLY_CHARS)

    const sid = sessionId || 'default'
    await prisma.$transaction([
      prisma.aIChatMessage.create({
        data: {
          businessId,
          sessionId: sid,
          role: 'user',
          message,
          metadata: JSON.stringify({ timestamp: new Date().toISOString() }),
        },
      }),
      prisma.aIChatMessage.create({
        data: {
          businessId,
          sessionId: sid,
          role: 'assistant',
          message: assistantMessage,
          metadata: JSON.stringify({
            tokens,
            decisionAction: decision.action,
            actionData,
            timestamp: new Date().toISOString(),
          }),
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: assistantMessage,
      tokens,
      action: actionData,
      ai: {
        hasKey: !!effectiveApiKey,
        indicator: !!effectiveApiKey && usedAi && decisionSource === 'llm' ? 'green' : 'red',
        usedAi,
        reason: aiUnavailableReason || (decisionSource ? `source:${decisionSource}` : null),
      },
    })
  } catch (error) {
    console.error('AI Chat API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process chat message' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const sessionId = searchParams.get('sessionId') || 'default'

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    const messages = await prisma.aIChatMessage.findMany({
      where: {
        businessId,
        sessionId,
      },
      orderBy: { createdAt: 'asc' },
    })

    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: { aiApiKey: true, aiChatEnabled: true },
    })
    const globalAiApiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()
    const hasKey = !!((biz?.aiApiKey?.trim() || globalAiApiKey || '').trim())
    const lastOk = aiLastSuccessAtByBusiness.get(businessId) || 0
    const isAiLikelyWorking = Date.now() - lastOk < AI_SUCCESS_TTL_MS
    return NextResponse.json({
      messages,
      ai: {
        hasKey,
        indicator: hasKey && biz?.aiChatEnabled && isAiLikelyWorking ? 'green' : 'red',
        usedAi: false,
        reason: !biz?.aiChatEnabled ? 'ai_disabled' : !hasKey ? 'key_missing' : isAiLikelyWorking ? null : 'no_recent_ai_success',
      },
    })
  } catch (error) {
    console.error('Get chat history error:', error)
    return NextResponse.json({ error: 'Failed to get chat history' }, { status: 500 })
  }
}
