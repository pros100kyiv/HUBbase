import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LmStudioChatService, type AgentDecision } from '@/lib/services/lm-studio-ai-service'
import { isValidUaPhone, normalizeUaPhone } from '@/lib/utils/phone'
import { getBusinessSnapshotText } from '@/lib/services/ai-snapshot'
import { runAiTool, type AiToolName } from '@/lib/services/ai-data-tools'
import { SMSService } from '@/lib/services/sms-service'

const DEFAULT_APPOINTMENT_DURATION_MINUTES = 60
const MAX_TOOL_CONTEXT_CHARS = 3800
const MAX_TOOL_LINE_CHARS = 1200
// Keep tool-calling to a single LLM request per user message.
const MAX_TOOL_CALLS = 1
const MAX_ASSISTANT_REPLY_CHARS = 900

// Best-effort in-memory cooldown to avoid repeated 429 calls.
// Note: serverless instances may restart; this is still useful within a warm instance.
const aiCooldownByBusiness = new Map<string, number>()
const aiLastSuccessAtByBusiness = new Map<string, number>()
const AI_SUCCESS_TTL_MS = 10 * 60 * 1000
const LM_CONFIG_CACHE_MS = 60 * 1000

interface LmStudioConfig {
  baseUrl: string | null
  model: string | null
  hasAi: boolean
}

const lmConfigCache: { config: LmStudioConfig | null; expiresAt: number } = {
  config: null,
  expiresAt: 0,
}

async function ensureSystemSettingTableExists(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SystemSetting" (
      "key" TEXT PRIMARY KEY,
      "value" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

async function getLmStudioConfig(): Promise<LmStudioConfig> {
  const now = Date.now()
  if (lmConfigCache.config && now < lmConfigCache.expiresAt) {
    return lmConfigCache.config
  }

  try {
    await ensureSystemSettingTableExists()
    const [providerRow, lmUrlRow, lmModelRow] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'ai_provider' }, select: { value: true } }),
      prisma.systemSetting.findUnique({ where: { key: 'lm_studio_base_url' }, select: { value: true } }),
      prisma.systemSetting.findUnique({ where: { key: 'lm_studio_model' }, select: { value: true } }),
    ])

    const providerVal = ((providerRow?.value || process.env.AI_PROVIDER || 'lm_studio') as string).trim().toLowerCase()
    const lmUrl = (lmUrlRow?.value || process.env.LM_STUDIO_URL || 'http://127.0.0.1:1234/v1').trim()
    const lmModel = (lmModelRow?.value || '').trim() || null
    const useLmStudio = providerVal === 'lm_studio' && !!lmUrl

    const config: LmStudioConfig = {
      baseUrl: useLmStudio ? lmUrl : null,
      model: useLmStudio ? lmModel : null,
      hasAi: useLmStudio,
    }

    lmConfigCache.config = config
    lmConfigCache.expiresAt = now + LM_CONFIG_CACHE_MS
    return config
  } catch {
    lmConfigCache.config = {
      baseUrl: null,
      model: null,
      hasAi: false,
    }
    return lmConfigCache.config
  }
}

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

function extractDateKeyCandidate(message: string): string | null {
  const m = message.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  return m?.[1] ? m[1] : null
}

function extractMasterNameCandidate(message: string): string | null {
  const m1 = message.match(/(?:майстер|master)\s*[:\-]?\s*([^\n,]+)$/i)
  if (m1?.[1]) return m1[1].trim()
  const m2 = message.match(/(?:майстер|master)\s+([^\n,]+)/i)
  if (m2?.[1]) return m2[1].trim()
  return null
}

function extractTimeCandidate(message: string): { hh: string; mm: string } | null {
  // 10:00 / 10 00 / 10.00
  const m1 = message.match(/\b([01]?\d|2[0-3])\s*[:.]\s*([0-5]\d)\b/)
  if (m1?.[1] && m1?.[2]) {
    return { hh: String(m1[1]).padStart(2, '0'), mm: String(m1[2]).padStart(2, '0') }
  }
  const m2 = message.match(/\b([01]?\d|2[0-3])\s+([0-5]\d)\b/)
  if (m2?.[1] && m2?.[2]) {
    return { hh: String(m2[1]).padStart(2, '0'), mm: String(m2[2]).padStart(2, '0') }
  }
  return null
}

function getDateKeyFromRelativeOrExplicit(message: string): string | null {
  const lower = message.toLowerCase()
  if (lower.includes('сьогодні') || lower.includes('today')) return new Date().toISOString().slice(0, 10)
  if (lower.includes('завтра') || lower.includes('tomorrow')) {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }
  return extractDateKeyCandidate(message)
}

function extractPhoneOnlyMessage(message: string): string | null {
  let raw = message.trim()
  // UI can sometimes send/echo JSON-stringified values: `"098..."`.
  if (
    (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) ||
    (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2)
  ) {
    raw = raw.slice(1, -1).trim()
  }
  // Phone-only messages (no extra words) are common follow-ups.
  if (!/^[+0-9][0-9+\s()-]{6,}$/.test(raw)) return null
  const normalized = normalizeUaPhone(raw)
  return isValidUaPhone(normalized) ? normalized : null
}

function tryBuildAppointmentFromRecentHistory(params: {
  messagePhone: string
  history: Array<{ role: string; message: string }>
  business: { services: Array<{ name: string }> }
}): AgentDecision | null {
  const { messagePhone, history, business } = params
  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant')?.message || ''
  const lastUser = [...history].reverse().find((m) => m.role === 'user')?.message || ''

  const a = lastAssistant.toLowerCase()
  const u = lastUser.toLowerCase()
  const askedForPhone = a.includes('номер') || a.includes('телефон') || a.includes('phone')
  const looksLikeBooking = u.includes('запиш') || u.includes('запис') || u.includes('appointment')
  if (!askedForPhone || !looksLikeBooking) return null

  const dateKey = getDateKeyFromRelativeOrExplicit(lastUser)
  const time = extractTimeCandidate(lastUser)
  if (!dateKey || !time) return null

  const doIdx = lastUser.toLowerCase().indexOf('до ')
  if (doIdx === -1) return null
  const tail = lastUser.slice(doIdx + 3).trim()
  if (!tail) return null

  const services = [...business.services].sort((a1, a2) => a2.name.length - a1.name.length)
  let serviceName: string | null = null
  let masterPart = tail
  for (const s of services) {
    const sLower = s.name.toLowerCase()
    const idx = tail.toLowerCase().indexOf(sLower)
    if (idx !== -1) {
      serviceName = s.name
      masterPart = tail.slice(0, idx).trim()
      break
    }
  }

  const masterName = masterPart.trim()
  if (!masterName) return null

  let clientName = lastUser
  clientName = clientName.replace(/запиш(?:и|іть)\s+/i, '')
  clientName = clientName.replace(/\bна\s+завтра\b/gi, '')
  clientName = clientName.replace(/\bна\s+сьогодні\b/gi, '')
  clientName = clientName.replace(new RegExp(`\\b${dateKey}\\b`, 'g'), '')
  clientName = clientName.replace(/\bна\s+([01]?\d|2[0-3])\s*[:.]\s*([0-5]\d)\b/i, '')
  clientName = clientName.replace(/\bна\s+([01]?\d|2[0-3])\s+([0-5]\d)\b/i, '')
  const cutIdx = clientName.toLowerCase().indexOf('до ')
  if (cutIdx !== -1) clientName = clientName.slice(0, cutIdx)
  clientName = clientName.replace(/[,\.\!]+/g, ' ').replace(/\s+/g, ' ').trim()
  const nameParts = clientName.split(' ').filter(Boolean)
  const finalClientName = nameParts.slice(0, 2).join(' ').trim()
  if (!finalClientName) return null

  const startTime = `${dateKey}T${time.hh}:${time.mm}`
  return {
    action: 'create_appointment',
    reply: 'Ок, створюю запис.',
    confidence: 0.75,
    needsConfirmation: false,
    payload: {
      clientName: finalClientName,
      clientPhone: messagePhone,
      masterName,
      ...(serviceName ? { serviceNames: [serviceName] } : {}),
      startTime,
    } as any,
  }
}

function formatMoneyUAH(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value || 0)
  if (!Number.isFinite(n)) return '0'
  // Keep it simple and ASCII; no Intl to avoid env differences.
  return String(Math.round(n))
}

function formatToolResultToReply(result: { tool: string; data: any }): string {
  const tool = result?.tool
  const data = result?.data
  const looksLikeJson = (s: string) => {
    const t = (s || '').trim()
    return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))
  }

  const summarizeUnknown = (): string => {
    if (data === null || data === undefined) return 'Готово.'
    if (typeof data === 'string') {
      const t = data.trim()
      if (!t) return 'Готово.'
      if (looksLikeJson(t)) {
        return 'Ок, отримав дані. Уточни, що саме показати (наприклад: "коротко", "списком", "тільки суми/кількість").'
      }
      return truncateText(t, 500)
    }
    if (Array.isArray(data)) {
      const n = data.length
      return `Ок, отримав дані (${n} шт.). Уточни, що саме показати.`
    }
    if (typeof data === 'object') {
      const keys = Object.keys(data || {}).slice(0, 10)
      const k = keys.length ? keys.join(', ') : 'без полів'
      return `Ок, отримав дані (${k}). Уточни, що саме показати.`
    }
    return 'Ок, отримав дані. Уточни, що саме показати.'
  }

  try {
    if (tool === 'who_working') {
      const working = Array.isArray(data?.working) ? data.working : []
      const date = data?.date || 'today'
      const fmt = (r: any) => `${r?.name || 'n/a'}${r?.start && r?.end ? ` ${r.start}-${r.end}` : ''}`
      return `Хто працює ${date}: ${working.length ? working.map(fmt).join(', ') : 'ніхто'}.`
    }
    if (tool === 'free_slots') {
      if (data?.error === 'master_required') return 'Для слотів вкажи майстра (masterName або masterId).'
      const slots = Array.isArray(data?.slots) ? data.slots : []
      const date = data?.date || ''
      const m = data?.master?.name || 'майстра'
      const dur = data?.durationMinutes || 60
      return `Вільні слоти ${date} для ${m} (${dur}хв): ${slots.length ? slots.slice(0, 16).map((s: string) => String(s).slice(11)).join(', ') : 'немає'}.`
    }
    if (tool === 'gaps_summary') {
      if (data?.error === 'master_required') return 'Для “дірки між записами” вкажи майстра (masterName або masterId).'
      const gaps = Array.isArray(data?.gaps) ? data.gaps : []
      const date = data?.date || ''
      const m = data?.master?.name || 'майстра'
      const minGap = data?.minGapMinutes || 30
      const fmt = (g: any) => `${g.start}-${g.end} (${g.minutes}хв)`
      return `Дірки ${date} для ${m} (>=${minGap}хв): ${gaps.length ? gaps.map(fmt).join(', ') : 'немає'}.`
    }
    if (tool === 'schedule_overview') {
      const masters = Array.isArray(data?.masters) ? data.masters : []
      return `Графік: майстрів активних=${masters.length}. ${masters
        .slice(0, 10)
        .map((m: any) => `${m.name}(${m.summary})`)
        .join('; ')}${masters.length > 10 ? '…' : ''}`
    }
    if (tool === 'analytics_kpi') {
      const kpi = data?.kpi || data
      return `KPI: записів=${kpi?.appointmentsTotal ?? 0}, виконано=${kpi?.appointmentsDone ?? 0}, скасовано=${kpi?.cancelled ?? 0}, нових клієнтів=${kpi?.newClients ?? 0}, дохід=${formatMoneyUAH(kpi?.revenue ?? 0)}.`
    }
    if (tool === 'payments_kpi') {
      const rows = Array.isArray(data?.byStatus) ? data.byStatus : []
      return `Payments: ${rows.length ? rows.map((r: any) => `${r.status}:${r.count}/${formatMoneyUAH(r.sum)}`).join(', ') : 'немає'}.`
    }
    if (tool === 'appointments_stats') {
      const byStatus = Array.isArray(data?.byStatus) ? data.byStatus : []
      return `Записи: ${byStatus.length ? byStatus.map((r: any) => `${r.status}:${r.count}`).join(', ') : '0'}.`
    }
    if (tool === 'appointments_list') {
      const rows = Array.isArray(data?.rows) ? data.rows : []
      return `Записи: ${rows.length ? rows.slice(0, 12).map((r: any) => `${String(r.start)} ${r.status} ${r.client || ''}(*${r.phoneLast4 || ''})`).join('\n') : 'немає'}.`
    }
    if (tool === 'clients_search') {
      const rows = Array.isArray(data?.rows) ? data.rows : []
      return `Клієнти: ${rows.length ? rows.map((c: any) => `${c.name}(*${c.phoneLast4})`).join(', ') : 'немає'}.`
    }
    if (tool === 'client_by_phone') {
      const c = data?.client
      if (!c) return 'Клієнта не знайдено.'
      return `Клієнт: ${c.name}(*${c.phoneLast4}), статус=${c.status || 'n/a'}, візитів=${c.totalAppointments ?? 0}, витрати=${formatMoneyUAH(c.totalSpent ?? 0)}.`
    }
    if (tool === 'segments_list') {
      const rows = Array.isArray(data?.rows) ? data.rows : []
      return `Сегменти: ${rows.length ? rows.map((r: any) => `${r.name}(${r.clientCount ?? 0})`).join(', ') : 'немає'}.`
    }
  } catch {
    // ignore and fall back to generic JSON
  }

  return summarizeUnknown()
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
  const wantsSchedule = containsAny(m, ['графік', 'schedule', 'working hours', 'hours', 'працює', 'хто працює', 'черг'])
  const wantsWhoWorking = containsAny(m, ['хто працює', 'who working', 'working today', 'працює сьогодні', 'працюють'])
  const wantsSlots = containsAny(m, ['слот', 'slots', 'вільні години', 'вільні слоти', 'free slots', 'available slots'])
  const wantsGaps = containsAny(m, ['дірк', 'gap', 'вікно між', 'між запис', 'порожн', 'простої'])
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
          ? 'Привіт! Чим можу допомогти? Можу показати записи, KPI, хто працює, клієнтів — просто напиши.'
          : 'Привіт! Я без AI поки що, але можу показати дані з кабінету. Напиши: "скільки записів", "хто працює", "покажи інбокс".',
      meta: { mode: 'data_fallback', kind: hasAiKey ? 'help' : 'no_key_help' },
    }
  }

  if (wantsHelp) {
    return {
      reply:
        hasAiKey
          ? 'Можу все: KPI, записи, клієнти, платежі, інбокс, нотатки, нагадування. Пиши природно — "скільки записів сьогодні", "знайди Петра", "покажи вільні слоти". Або командами: note:, reminder:, appointment:.'
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
    !wantsSchedule &&
    !wantsWhoWorking &&
    !wantsSlots &&
    !wantsGaps &&
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
  let scheduleOverview: any = null
  let whoWorking: any = null
  let freeSlots: any = null
  let gapsSummary: any = null

  const days = parseDaysFromText(message, 7)
  const limit = parseLimitFromText(message, 10)
  const phone = extractUaPhoneCandidate(message)
  const q = extractSearchQuery(message)
  const dateKey = extractDateKeyCandidate(message)
  const masterNameCandidate = extractMasterNameCandidate(message)
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

  if (wantsSchedule) {
    toolCalls.push(
      runAiTool(businessId, 'schedule_overview', {}).then((r) => {
        scheduleOverview = r
      })
    )
  }

  if (wantsWhoWorking || (wantsSchedule && containsAny(m, ['сьогодні', 'today']))) {
    toolCalls.push(
      runAiTool(businessId, 'who_working', { date: dateKey || undefined }).then((r) => {
        whoWorking = r
      })
    )
  }

  if (wantsSlots) {
    toolCalls.push(
      runAiTool(businessId, 'free_slots', {
        date: dateKey || undefined,
        masterName: masterNameCandidate || undefined,
        durationMinutes: containsAny(m, ['30']) ? 30 : containsAny(m, ['90']) ? 90 : 60,
        limit: Math.min(24, Math.max(6, limit)),
      }).then((r) => {
        freeSlots = r
      })
    )
  }

  if (wantsGaps) {
    toolCalls.push(
      runAiTool(businessId, 'gaps_summary', {
        date: dateKey || undefined,
        masterName: masterNameCandidate || undefined,
        minGapMinutes: 30,
        limit: Math.min(10, Math.max(3, limit)),
      }).then((r) => {
        gapsSummary = r
      })
    )
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

  if ((wantsWhoWorking || wantsSchedule) && whoWorking && typeof whoWorking === 'object') {
    const data = (whoWorking as any).data || (whoWorking as any)
    const working = Array.isArray(data.working) ? data.working : []
    const off = Array.isArray(data.off) ? data.off : []
    const date = data.date || dateKey || 'today'
    const fmt = (r: any) => `${r.name}${r.start && r.end ? ` ${r.start}-${r.end}` : ''}`
    parts.push(
      `Хто працює ${date}: ${working.length ? working.map(fmt).join(', ') : 'ніхто'}. Вихідні: ${off.length ? off.slice(0, 10).map((r: any) => r.name).join(', ') : '—'}.`
    )
    meta.whoWorking = data
  } else if (wantsWhoWorking && !whoWorking) {
    parts.push('Щоб показати хто працює — напиши дату (YYYY-MM-DD) або "сьогодні".')
  }

  if (wantsSchedule && scheduleOverview && typeof scheduleOverview === 'object') {
    const data = (scheduleOverview as any).data || (scheduleOverview as any)
    const masters = Array.isArray(data.masters) ? data.masters : []
    parts.push(
      `Графік: майстрів активних=${masters.length}. Коротко: ${masters.slice(0, 12).map((m: any) => `${m.name} (${m.summary})`).join('; ')}${masters.length > 12 ? '…' : ''}`
    )
    meta.scheduleOverview = data
  }

  if (wantsSlots && freeSlots && typeof freeSlots === 'object') {
    const data = (freeSlots as any).data || (freeSlots as any)
    if (data?.error === 'master_required') {
      parts.push('Для слотів напиши майстра: "слоти майстер AI Master" або "free slots master: AI Master".')
    } else {
      const slots = Array.isArray(data.slots) ? data.slots : []
      parts.push(
        `Вільні слоти ${data.date || dateKey || ''} для ${data.master?.name || 'майстра'} (${data.durationMinutes || 60}хв): ${slots.length ? slots.slice(0, 16).map((s: string) => s.slice(11)).join(', ') : 'немає'}.`
      )
      meta.freeSlots = data
    }
  }

  if (wantsGaps && gapsSummary && typeof gapsSummary === 'object') {
    const data = (gapsSummary as any).data || (gapsSummary as any)
    if (data?.error === 'master_required') {
      parts.push('Для "дірки між записами" напиши майстра: "дірки майстер AI Master".')
    } else {
      const gaps = Array.isArray(data.gaps) ? data.gaps : []
      parts.push(
        `Дірки ${data.date || dateKey || ''} для ${data.master?.name || 'майстра'} (>=${data.minGapMinutes || 30}хв): ${gaps.length ? gaps.map((g: any) => `${g.start}-${g.end} (${g.minutes}хв)`).join(', ') : 'немає'}.`
      )
      // Quick actionable tip without LLM.
      if (gaps.length >= 2) {
        parts.push('Порада: ці “вікна” можна закрити акцією -10% на найближчі 24 години або короткими послугами 30-45хв.')
      }
      meta.gaps = data
    }
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
  const explicit = tryBuildExplicitCommandDecision(message, business)
  if (explicit) return explicit

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
        'Я твій помічник по кабінету — записи, клієнти, майстри, послуги, платежі, інбокс, нотатки. Пиши що завгодно: "скільки записів сьогодні", "покажи вільні слоти", "хто працює", "знайди клієнта Іван". Можу і створити запис чи нотатку — просто скажи.',
      confidence: 1,
    }
  }

  return {
    action: 'reply',
    reply:
      'Зараз AI трохи відстає, але я все одно можу показати дані. Напиши: "скільки записів сьогодні", "хто сьогодні працює", "payments за 30 днів", "покажи інбокс".\n\nЯкщо потрібна саме “розумна” дія (створити запис/послугу) — спробуй ще раз через хвилину.',
    confidence: 0.2,
  }
}

function tryBuildExplicitCommandDecision(
  message: string,
  business: {
    services: Array<{ id: string; name: string; duration: number }>
  }
): AgentDecision | null {
  const raw = message.trim()

  const bizHoursMatch = raw.match(/^(?:hours_business|business_hours|графік бізнесу)\s*:\s*(\{[\s\S]+\})\s*$/i)
  if (bizHoursMatch?.[1]) {
    return {
      action: 'update_business_working_hours',
      reply: 'Ок, оновлюю графік бізнесу.',
      confidence: 0.95,
      needsConfirmation: false,
      payload: { workingHours: bizHoursMatch[1].trim() },
    }
  }

  const masterHoursMatch = raw.match(/^(?:hours_master|master_hours|графік майстра)\s*:\s*([^,]+)\s*,\s*(\{[\s\S]+\})\s*$/i)
  if (masterHoursMatch?.[1] && masterHoursMatch?.[2]) {
    const who = masterHoursMatch[1].trim()
    const json = masterHoursMatch[2].trim()
    return {
      action: 'update_master_working_hours',
      reply: 'Ок, оновлюю графік майстра.',
      confidence: 0.95,
      needsConfirmation: false,
      payload: { masterId: who, masterName: who, workingHours: json },
    }
  }

  const overrideMatch = raw.match(
    /^(?:override_master|master_override|виключення майстра)\s*:\s*([^,]+)\s*,\s*(\d{4}-\d{2}-\d{2})\s*,\s*(off|вихідний|(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2}))\s*$/i
  )
  if (overrideMatch?.[1] && overrideMatch?.[2] && overrideMatch?.[3]) {
    const who = overrideMatch[1].trim()
    const date = overrideMatch[2].trim()
    const isOff = overrideMatch[3].toLowerCase().includes('off') || overrideMatch[3].toLowerCase().includes('вих')
    const start = overrideMatch[4]?.trim()
    const end = overrideMatch[5]?.trim()
    return {
      action: 'set_master_date_override',
      reply: 'Ок, зберігаю виключення графіку.',
      confidence: 0.95,
      needsConfirmation: false,
      payload: {
        masterId: who,
        masterName: who,
        date,
        enabled: !isOff,
        ...(isOff ? {} : { start: start || '09:00', end: end || '18:00' }),
      },
    }
  }

  const clearOverrideMatch = raw.match(
    /^(?:clear_override_master|clear master override|очистити виключення)\s*:\s*([^,]+)\s*,\s*(\d{4}-\d{2}-\d{2})\s*$/i
  )
  if (clearOverrideMatch?.[1] && clearOverrideMatch?.[2]) {
    const who = clearOverrideMatch[1].trim()
    const date = clearOverrideMatch[2].trim()
    return {
      action: 'clear_master_date_override',
      reply: 'Ок, прибираю виключення.',
      confidence: 0.95,
      needsConfirmation: false,
      payload: { masterId: who, masterName: who, date },
    }
  }

  const cancelMatch = raw.match(/^(?:cancel|скасувати|відмінити)\s*(?:appointment|запис)?\s*:\s*(\S+)\s*$/i)
  if (cancelMatch?.[1]) {
    return {
      action: 'cancel_appointment',
      reply: 'Ок, скасовую запис.',
      confidence: 0.95,
      needsConfirmation: false,
      payload: { appointmentId: cancelMatch[1].trim() },
    }
  }

  const rescheduleMatch = raw.match(
    /^(?:reschedule|перенести)\s*(?:appointment|запис)?\s*:\s*(\S+)\s*,\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?:\s*,\s*(\d+))?\s*$/i
  )
  if (rescheduleMatch?.[1] && rescheduleMatch?.[2]) {
    const durationMinutes = rescheduleMatch[3] ? Number(rescheduleMatch[3]) : undefined
    return {
      action: 'reschedule_appointment',
      reply: 'Ок, переношу запис.',
      confidence: 0.95,
      needsConfirmation: false,
      payload: {
        appointmentId: rescheduleMatch[1].trim(),
        newStartTime: rescheduleMatch[2].trim(),
        ...(durationMinutes ? { durationMinutes } : {}),
      },
    }
  }

  const smsMatch = raw.match(/^(?:sms)\s*:\s*([^,]+)\s*,\s*(.+)$/i)
  if (smsMatch?.[1] && smsMatch?.[2]) {
    const phone = smsMatch[1].trim()
    const msg = smsMatch[2].trim()
    return {
      action: 'send_sms',
      reply: 'Ок, відправляю SMS.',
      confidence: 0.95,
      needsConfirmation: false,
      payload: { phone, message: msg },
    }
  }

  const tagMatch = raw.match(/^(?:tag|тег)\s*:\s*([^,]+)\s*,\s*(.+)$/i)
  if (tagMatch?.[1] && tagMatch?.[2]) {
    const who = tagMatch[1].trim()
    const tag = tagMatch[2].trim()
    const looksLikePhone = /^[+0-9][0-9+\s()-]{5,}$/.test(who)
    return {
      action: 'add_client_tag',
      reply: 'Ок, додаю тег.',
      confidence: 0.95,
      needsConfirmation: false,
      payload: looksLikePhone ? { clientPhone: who, tag } : { clientId: who, tag },
    }
  }

  const masterMatch = raw.match(/^(?:master|майстер)\s*:\s*([^,]+)(?:\s*,\s*(.+))?\s*$/i)
  if (masterMatch?.[1]) {
    const name = masterMatch[1].trim()
    const bio = masterMatch[2]?.trim()
    return {
      action: 'create_master',
      reply: 'Ок, додаю майстра.',
      confidence: 0.95,
      needsConfirmation: false,
      payload: { name, ...(bio ? { bio } : {}) },
    }
  }

  const serviceOffMatch = raw.match(
    /^(?:service_off|disable service|delete service|вимкнути послугу|видалити послугу)\s*:\s*(.+)$/i
  )
  if (serviceOffMatch?.[1]) {
    return {
      action: 'delete_service',
      reply: 'Ок, вимикаю послугу.',
      confidence: 0.95,
      needsConfirmation: false,
      payload: { name: serviceOffMatch[1].trim() },
    }
  }

  const segmentMatch = raw.match(/^(?:segment|сегмент)\s*:\s*([^,]+)\s*,\s*(.+)$/i)
  if (segmentMatch?.[1] && segmentMatch?.[2]) {
    return {
      action: 'create_segment',
      reply: 'Ок, створюю сегмент.',
      confidence: 0.95,
      needsConfirmation: false,
      payload: { name: segmentMatch[1].trim(), criteria: segmentMatch[2].trim(), autoUpdate: false },
    }
  }

  const clientMatch = raw.match(/^(?:client|клієнт)\s*:\s*([^,]+),\s*([^,]+)(?:,\s*(.+))?$/i)
  if (clientMatch) {
    const name = clientMatch[1].trim()
    const phone = clientMatch[2].trim()
    const email = clientMatch[3]?.trim()
    return {
      action: 'create_client',
      reply: 'Готово, додаю клієнта.',
      confidence: 0.9,
      needsConfirmation: false,
      payload: { name, phone, ...(email ? { email } : {}) },
    }
  }

  const serviceMatch = raw.match(/^(?:service|послуга)\s*:\s*([^,]+),\s*(\d+)(?:,\s*(\d+))?(?:,\s*(.+))?$/i)
  if (serviceMatch) {
    const name = serviceMatch[1].trim()
    const price = Number(serviceMatch[2])
    const duration = serviceMatch[3] ? Number(serviceMatch[3]) : 60
    const category = serviceMatch[4]?.trim()
    return {
      action: 'create_service',
      reply: 'Готово, додаю послугу.',
      confidence: 0.9,
      needsConfirmation: false,
      payload: { name, price, duration, ...(category ? { category } : {}) },
    }
  }

  const noteMatch = raw.match(/^(?:note|нотатка|замітка|create note)\s*:\s*(.+)$/i)
  if (noteMatch?.[1]) {
    return {
      action: 'create_note',
      reply: 'Готово, створюю нотатку.',
      confidence: 0.9,
      needsConfirmation: false,
      payload: { text: noteMatch[1].trim() },
    }
  }

  const reminderMatch = raw.match(/^(?:reminder|нагадування)\s*:\s*(.+)$/i)
  if (reminderMatch?.[1]) {
    return {
      action: 'create_reminder',
      reply: 'Готово, створюю нагадування.',
      confidence: 0.9,
      needsConfirmation: false,
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
      confidence: 0.9,
      needsConfirmation: false,
      payload: {
        clientName,
        clientPhone,
        masterName,
        startTime,
        serviceIds: serviceId ? [serviceId] : [],
      },
    }
  }

  return null
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

  function toScheduleJson(raw: unknown): string | null {
    if (raw == null) return null
    if (typeof raw === 'string') {
      const s = raw.trim()
      if (!s) return null
      // Allow passing a JSON string directly.
      try {
        const parsed = JSON.parse(s)
        return JSON.stringify(parsed)
      } catch {
        return null
      }
    }
    try {
      return JSON.stringify(raw)
    } catch {
      return null
    }
  }

  async function resolveMasterForChange(): Promise<{ id: string; name: string; workingHours: string | null; scheduleDateOverrides: string | null } | null> {
    const masterId = safeText((payload as any).masterId)
    const masterName = safeText((payload as any).masterName)
    if (!masterId && !masterName) return null
    const master = masterId
      ? await prisma.master.findFirst({
          where: { businessId, id: masterId },
          select: { id: true, name: true, workingHours: true, scheduleDateOverrides: true },
        })
      : await prisma.master.findFirst({
          where: { businessId, name: { contains: masterName!, mode: 'insensitive' } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, workingHours: true, scheduleDateOverrides: true },
        })
    return master || null
  }

  async function resolveClientForChange(): Promise<{ id: string; name: string } | null> {
    const clientId = safeText((payload as any).clientId)
    const phoneRaw = safeText((payload as any).clientPhone)
    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { businessId, id: clientId },
        select: { id: true, name: true },
      })
      return client || null
    }
    if (phoneRaw) {
      const phone = normalizeUaPhone(phoneRaw)
      if (!isValidUaPhone(phone)) return null
      const client = await prisma.client.findUnique({
        where: { businessId_phone: { businessId, phone } },
        select: { id: true, name: true },
      })
      return client || null
    }
    return null
  }

  async function resolveAppointmentForChange(): Promise<{
    appt: { id: string; masterId: string; startTime: Date; endTime: Date; status: string; clientPhone: string; clientName: string }
    resolution: 'by_id' | 'by_phone_time' | 'by_phone_next' | 'by_name_next'
  } | null> {
    const appointmentId = safeText((payload as any).appointmentId)
    if (appointmentId) {
      const appt = await prisma.appointment.findFirst({
        where: { id: appointmentId, businessId },
        select: { id: true, masterId: true, startTime: true, endTime: true, status: true, clientPhone: true, clientName: true },
      })
      return appt ? { appt, resolution: 'by_id' } : null
    }

    const phoneRaw = safeText((payload as any).clientPhone)
    const nameQ = safeText((payload as any).clientName)
    const oldStart = parseDateTime((payload as any).startTime || (payload as any).oldStartTime)
    const now = new Date(Date.now() - 2 * 60 * 60 * 1000) // allow recent past

    if (phoneRaw) {
      const phone = normalizeUaPhone(phoneRaw)
      if (!isValidUaPhone(phone)) return null

      if (oldStart) {
        const appt = await prisma.appointment.findFirst({
          where: { businessId, clientPhone: phone, startTime: oldStart },
          select: { id: true, masterId: true, startTime: true, endTime: true, status: true, clientPhone: true, clientName: true },
        })
        return appt ? { appt, resolution: 'by_phone_time' } : null
      }

      const appt = await prisma.appointment.findFirst({
        where: {
          businessId,
          clientPhone: phone,
          startTime: { gte: now },
          status: { notIn: ['Cancelled', 'Скасовано'] },
        },
        orderBy: { startTime: 'asc' },
        select: { id: true, masterId: true, startTime: true, endTime: true, status: true, clientPhone: true, clientName: true },
      })
      return appt ? { appt, resolution: 'by_phone_next' } : null
    }

    if (nameQ) {
      const appt = await prisma.appointment.findFirst({
        where: {
          businessId,
          clientName: { contains: nameQ, mode: 'insensitive' },
          startTime: { gte: now },
          status: { notIn: ['Cancelled', 'Скасовано'] },
        },
        orderBy: { startTime: 'asc' },
        select: { id: true, masterId: true, startTime: true, endTime: true, status: true, clientPhone: true, clientName: true },
      })
      return appt ? { appt, resolution: 'by_name_next' } : null
    }

    return null
  }

  if (decision.action === 'create_client') {
    const name = safeText((payload as any).name)
    const phoneRaw = safeText((payload as any).phone)
    const email = safeText((payload as any).email)
    const notes = safeText((payload as any).notes)

    if (!name) {
      return {
        message: decision.reply || 'Ок. Як звати клієнта?',
        actionData: { action: 'create_client', status: 'missing_fields', missing: ['name'] },
      }
    }
    if (!phoneRaw) {
      return {
        message: decision.reply || 'Ок. Дай номер телефону клієнта (формат +380... або 0...).',
        actionData: { action: 'create_client', status: 'missing_fields', missing: ['phone'] },
      }
    }

    const phone = normalizeUaPhone(phoneRaw)
    if (!isValidUaPhone(phone)) {
      return {
        message: 'Телефон виглядає невалідним. Напиши, будь ласка, український номер (наприклад 0671234567 або +380671234567).',
        actionData: { action: 'create_client', status: 'invalid_phone' },
      }
    }

    // Unique within business by phone -> use upsert to avoid duplicates.
    const client = await prisma.client.upsert({
      where: { businessId_phone: { businessId, phone } },
      create: {
        businessId,
        name,
        phone,
        email,
        notes,
      },
      update: {
        name,
        ...(email ? { email } : {}),
        ...(notes ? { notes } : {}),
      },
      select: { id: true, name: true, phone: true, email: true, createdAt: true },
    })

    return {
      message: decision.reply || `Готово. Клієнт "${client.name}" доданий/оновлений.`,
      actionData: { action: 'create_client', status: 'completed', client },
    }
  }

  if (decision.action === 'create_service') {
    const name = safeText((payload as any).name)
    const priceRaw = (payload as any).price
    const durationRaw = (payload as any).duration
    const category = safeText((payload as any).category)
    const subcategory = safeText((payload as any).subcategory)
    const description = safeText((payload as any).description)

    const price = typeof priceRaw === 'number' && Number.isFinite(priceRaw) ? Math.round(priceRaw) : null
    const duration = typeof durationRaw === 'number' && Number.isFinite(durationRaw) ? Math.round(durationRaw) : null

    if (!name) {
      return {
        message: decision.reply || 'Ок. Як називається послуга?',
        actionData: { action: 'create_service', status: 'missing_fields', missing: ['name'] },
      }
    }
    if (price == null || price < 0) {
      return {
        message: decision.reply || 'Ок. Яка ціна послуги? (число)',
        actionData: { action: 'create_service', status: 'missing_fields', missing: ['price'] },
      }
    }
    if (duration == null || duration <= 0) {
      return {
        message: decision.reply || 'Ок. Яка тривалість послуги (хв)?',
        actionData: { action: 'create_service', status: 'missing_fields', missing: ['duration'] },
      }
    }

    // Best-effort: update service if same name exists to avoid duplicates.
    const existing = await prisma.service.findFirst({
      where: { businessId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true, name: true, price: true, duration: true },
    })

    const service = existing
      ? await prisma.service.update({
          where: { id: existing.id },
          data: {
            name,
            price,
            duration,
            category,
            subcategory,
            description,
          },
          select: { id: true, name: true, price: true, duration: true, category: true, subcategory: true },
        })
      : await prisma.service.create({
          data: {
            businessId,
            name,
            price,
            duration,
            category,
            subcategory,
            description,
            isActive: true,
          },
          select: { id: true, name: true, price: true, duration: true, category: true, subcategory: true },
        })

    return {
      message: decision.reply || `Готово. Послуга "${service.name}" додана/оновлена.`,
      actionData: { action: 'create_service', status: 'completed', service, updatedExisting: !!existing },
    }
  }

  if (decision.action === 'create_master') {
    const name = safeText((payload as any).name)
    const bio = safeText((payload as any).bio)
    const photo = safeText((payload as any).photo)
    // Prefer structured object to avoid JSON-escaping issues in LLM output.
    const workingHoursJson = toScheduleJson((payload as any).workingHours ?? (payload as any).workingHoursJson)
    if (!name) {
      return {
        message: decision.reply || 'Ок. Як звати майстра?',
        actionData: { action: 'create_master', status: 'missing_fields', missing: ['name'] },
      }
    }

    const master = await prisma.master.create({
      data: {
        businessId,
        name,
        bio,
        photo,
        workingHours: workingHoursJson,
        isActive: true,
      },
      select: { id: true, name: true, isActive: true, createdAt: true },
    })

    return {
      message: decision.reply || `Готово. Майстер "${master.name}" доданий.`,
      actionData: { action: 'create_master', status: 'completed', master },
    }
  }

  if (decision.action === 'delete_service') {
    const serviceId = safeText((payload as any).serviceId)
    const name = safeText((payload as any).name)
    if (!serviceId && !name) {
      return {
        message: decision.reply || 'Ок. Яку послугу вимкнути? (serviceId або назва)',
        actionData: { action: 'delete_service', status: 'missing_fields', missing: ['serviceId|name'] },
      }
    }

    const service = serviceId
      ? await prisma.service.findFirst({ where: { id: serviceId, businessId }, select: { id: true, name: true, isActive: true } })
      : await prisma.service.findFirst({
          where: { businessId, name: { contains: name!, mode: 'insensitive' } },
          orderBy: { updatedAt: 'desc' },
          select: { id: true, name: true, isActive: true },
        })

    if (!service) {
      return {
        message: 'Не знайшов таку послугу. Напиши точну назву або serviceId.',
        actionData: { action: 'delete_service', status: 'not_found' },
      }
    }

    const updated = await prisma.service.update({
      where: { id: service.id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true, updatedAt: true },
    })

    return {
      message: decision.reply || `Готово. Послугу "${updated.name}" вимкнено.`,
      actionData: { action: 'delete_service', status: 'completed', service: updated },
    }
  }

  if (decision.action === 'update_service') {
    const serviceId = safeText((payload as any).serviceId)
    const name = safeText((payload as any).name)
    const priceRaw = (payload as any).price
    const durationRaw = (payload as any).duration
    const category = safeText((payload as any).category)

    const service = serviceId
      ? await prisma.service.findFirst({ where: { id: serviceId, businessId }, select: { id: true, name: true } })
      : name
        ? await prisma.service.findFirst({ where: { businessId, name: { contains: name, mode: 'insensitive' } }, select: { id: true, name: true } })
        : null

    if (!service) {
      return {
        message: decision.reply || 'Не знайшов послугу. Дай serviceId або name.',
        actionData: { action: 'update_service', status: 'service_not_found' },
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name) updateData.name = name
    if (typeof priceRaw === 'number' && Number.isFinite(priceRaw)) updateData.price = Math.round(priceRaw)
    if (typeof durationRaw === 'number' && Number.isFinite(durationRaw)) updateData.duration = Math.round(durationRaw)
    if (category !== null) updateData.category = category || null

    if (Object.keys(updateData).length === 0) {
      return {
        message: decision.reply || 'Що саме оновити? (name, price, duration, category)',
        actionData: { action: 'update_service', status: 'missing_fields' },
      }
    }

    const updated = await prisma.service.update({
      where: { id: service.id },
      data: updateData as any,
      select: { id: true, name: true, price: true, duration: true, category: true },
    })

    return {
      message: decision.reply || `Готово. Послугу "${updated.name}" оновлено.`,
      actionData: { action: 'update_service', status: 'completed', service: updated },
    }
  }

  if (decision.action === 'update_master') {
    const master = await resolveMasterForChange()
    if (!master) {
      return {
        message: decision.reply || 'Ок. Для кого оновити? Дай masterId або masterName.',
        actionData: { action: 'update_master', status: 'master_not_found' },
      }
    }
    const name = safeText((payload as any).name)
    const bio = safeText((payload as any).bio)
    const workingHoursJson = toScheduleJson((payload as any).workingHours)
    const updateData: Record<string, unknown> = {}
    if (name) updateData.name = name
    if (bio !== null) updateData.bio = bio || null
    if (workingHoursJson) updateData.workingHours = workingHoursJson
    if (Object.keys(updateData).length === 0) {
      return {
        message: decision.reply || 'Що саме оновити? (name, bio, workingHours)',
        actionData: { action: 'update_master', status: 'missing_fields' },
      }
    }
    const updated = await prisma.master.update({
      where: { id: master.id },
      data: updateData as any,
      select: { id: true, name: true, bio: true, workingHours: true },
    })
    return {
      message: decision.reply || `Готово. Майстра "${updated.name}" оновлено.`,
      actionData: { action: 'update_master', status: 'completed', master: updated },
    }
  }

  if (decision.action === 'delete_master') {
    const master = await resolveMasterForChange()
    if (!master) {
      return {
        message: decision.reply || 'Ок. Кого видалити? Дай masterId або masterName.',
        actionData: { action: 'delete_master', status: 'master_not_found' },
      }
    }
    await prisma.master.update({
      where: { id: master.id },
      data: { isActive: false },
    })
    return {
      message: decision.reply || `Готово. Майстра "${master.name}" деактивовано.`,
      actionData: { action: 'delete_master', status: 'completed', master: { id: master.id, name: master.name } },
    }
  }

  if (decision.action === 'add_client_tag') {
    const clientId = safeText((payload as any).clientId)
    const phoneRaw = safeText((payload as any).clientPhone)
    const tag = safeText((payload as any).tag)
    if (!tag) {
      return {
        message: decision.reply || 'Ок. Який тег додати?',
        actionData: { action: 'add_client_tag', status: 'missing_fields', missing: ['tag'] },
      }
    }
    if (!clientId && !phoneRaw) {
      return {
        message: decision.reply || 'Ок. Для кого? Дай phone або clientId.',
        actionData: { action: 'add_client_tag', status: 'missing_fields', missing: ['clientPhone|clientId'] },
      }
    }

    const phone = phoneRaw ? normalizeUaPhone(phoneRaw) : null
    if (phoneRaw && (!phone || !isValidUaPhone(phone))) {
      return {
        message: 'Телефон виглядає невалідним. Напиши український номер (067... або +380...).',
        actionData: { action: 'add_client_tag', status: 'invalid_phone' },
      }
    }

    const client = clientId
      ? await prisma.client.findFirst({ where: { id: clientId, businessId }, select: { id: true, name: true, tags: true } })
      : await prisma.client.findUnique({ where: { businessId_phone: { businessId, phone: phone! } }, select: { id: true, name: true, tags: true } })

    if (!client) {
      return {
        message: 'Не знайшов клієнта. Перевір phone/clientId.',
        actionData: { action: 'add_client_tag', status: 'client_not_found' },
      }
    }

    const tagsRaw = parseJson<any>(client.tags, [])
    const tags = Array.isArray(tagsRaw) ? tagsRaw.filter((t) => typeof t === 'string') : []
    if (!tags.includes(tag)) tags.push(tag)

    const updated = await prisma.client.update({
      where: { id: client.id },
      data: { tags: JSON.stringify(tags.slice(0, 60)) },
      select: { id: true, name: true, tags: true },
    })

    return {
      message: decision.reply || `Готово. Додав тег "${tag}" клієнту "${updated.name}".`,
      actionData: { action: 'add_client_tag', status: 'completed', client: { id: updated.id, name: updated.name, tags } },
    }
  }

  if (decision.action === 'remove_client_tag') {
    const clientId = safeText((payload as any).clientId)
    const phoneRaw = safeText((payload as any).clientPhone)
    const tag = safeText((payload as any).tag)
    if (!tag) {
      return {
        message: decision.reply || 'Ок. Який тег прибрати?',
        actionData: { action: 'remove_client_tag', status: 'missing_fields', missing: ['tag'] },
      }
    }
    const client = await (clientId
      ? prisma.client.findFirst({ where: { id: clientId, businessId }, select: { id: true, name: true, tags: true } })
      : phoneRaw
        ? prisma.client.findUnique({ where: { businessId_phone: { businessId, phone: normalizeUaPhone(phoneRaw) } }, select: { id: true, name: true, tags: true } })
        : null)
    if (!client) {
      return {
        message: 'Не знайшов клієнта. Перевір phone/clientId.',
        actionData: { action: 'remove_client_tag', status: 'client_not_found' },
      }
    }
    const tagsRaw = parseJson<any>(client.tags, [])
    const tags = Array.isArray(tagsRaw) ? tagsRaw.filter((t: unknown) => typeof t === 'string' && t !== tag) : []
    await prisma.client.update({
      where: { id: client.id },
      data: { tags: JSON.stringify(tags) },
    })
    return {
      message: decision.reply || `Готово. Прибрав тег "${tag}" у клієнта "${client.name}".`,
      actionData: { action: 'remove_client_tag', status: 'completed', client: { id: client.id, name: client.name } },
    }
  }

  if (decision.action === 'update_client') {
    const resolved = await resolveClientForChange()
    if (!resolved) {
      return {
        message: decision.reply || 'Ок. Для кого оновити? Дай clientId або clientPhone.',
        actionData: { action: 'update_client', status: 'client_not_found' },
      }
    }
    const name = safeText((payload as any).name)
    const email = safeText((payload as any).email)
    const notes = safeText((payload as any).notes)
    const updateData: Record<string, unknown> = {}
    if (name) updateData.name = name
    if (email !== null) updateData.email = email || null
    if (notes !== null) updateData.notes = notes || null
    if (Object.keys(updateData).length === 0) {
      return {
        message: decision.reply || 'Що саме оновити? (name, email, notes)',
        actionData: { action: 'update_client', status: 'missing_fields' },
      }
    }
    const updated = await prisma.client.update({
      where: { id: resolved.id },
      data: updateData as any,
      select: { id: true, name: true, email: true, notes: true },
    })
    return {
      message: decision.reply || `Готово. Клієнта "${updated.name}" оновлено.`,
      actionData: { action: 'update_client', status: 'completed', client: updated },
    }
  }

  if (decision.action === 'delete_client') {
    const resolved = await resolveClientForChange()
    if (!resolved) {
      return {
        message: decision.reply || 'Ок. Кого видалити? Дай clientId або clientPhone.',
        actionData: { action: 'delete_client', status: 'client_not_found' },
      }
    }
    await prisma.client.update({
      where: { id: resolved.id },
      data: { isActive: false },
    })
    return {
      message: decision.reply || `Готово. Клієнта "${resolved.name}" деактивовано.`,
      actionData: { action: 'delete_client', status: 'completed', client: { id: resolved.id, name: resolved.name } },
    }
  }

  if (decision.action === 'send_sms') {
    const msgText = safeText((payload as any).message) || safeText(message)
    const phoneRaw = safeText((payload as any).phone) || safeText((payload as any).clientPhone)
    if (!msgText) {
      return {
        message: decision.reply || 'Ок. Який текст SMS надіслати?',
        actionData: { action: 'send_sms', status: 'missing_fields', missing: ['message'] },
      }
    }
    if (!phoneRaw) {
      return {
        message: decision.reply || 'Ок. На який номер? (phone або clientPhone)',
        actionData: { action: 'send_sms', status: 'missing_fields', missing: ['phone|clientPhone'] },
      }
    }
    const phone = normalizeUaPhone(phoneRaw)
    if (!isValidUaPhone(phone)) {
      return {
        message: 'Телефон виглядає невалідним. Напиши український номер (067... або +380...).',
        actionData: { action: 'send_sms', status: 'invalid_phone' },
      }
    }

    const bizSms = await prisma.business.findUnique({
      where: { id: businessId },
      select: { smsProvider: true, smsApiKey: true, smsSender: true },
    })
    if (!bizSms?.smsProvider || !bizSms.smsApiKey) {
      const rec = await prisma.sMSMessage.create({
        data: {
          businessId,
          phone,
          message: msgText,
          status: 'failed',
          errorMessage: 'SMS provider is not configured',
        },
        select: { id: true, status: true },
      })
      return {
        message: 'SMS не налаштований. Підключи SMS провайдера в налаштуваннях кабінету, і я зможу відправляти повідомлення.',
        actionData: { action: 'send_sms', status: 'sms_not_configured', smsMessage: rec },
      }
    }

    const smsService = new SMSService(bizSms.smsProvider, bizSms.smsApiKey, bizSms.smsSender || 'Xbase')
    let result: { success: boolean; messageId?: string } | null = null
    let errorMessage: string | null = null
    try {
      result = await smsService.send(phone, msgText)
      if (!result.success) errorMessage = 'Provider rejected message'
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : String(e)
    }

    const status = result?.success ? 'sent' : 'failed'
    const rec = await prisma.sMSMessage.create({
      data: {
        businessId,
        phone,
        message: msgText,
        status,
        providerMessageId: result?.messageId || null,
        errorMessage,
        sentAt: status === 'sent' ? new Date() : null,
      },
      select: { id: true, status: true, providerMessageId: true, sentAt: true },
    })

    return {
      message: status === 'sent' ? (decision.reply || 'Готово. SMS відправлено.') : 'Не вдалося відправити SMS. Перевір налаштування провайдера.',
      actionData: { action: 'send_sms', status, smsMessage: rec, errorMessage },
    }
  }

  if (decision.action === 'create_segment') {
    const name = safeText((payload as any).name)
    const criteriaRaw = (payload as any).criteria
    const autoUpdate = (payload as any).autoUpdate === true
    if (!name) {
      return {
        message: decision.reply || 'Ок. Як назвати сегмент?',
        actionData: { action: 'create_segment', status: 'missing_fields', missing: ['name'] },
      }
    }
    if (criteriaRaw == null) {
      return {
        message: decision.reply || 'Ок. Які критерії? (наприклад: lastVisitDays>90 або JSON)',
        actionData: { action: 'create_segment', status: 'missing_fields', missing: ['criteria'] },
      }
    }

    const criteria =
      typeof criteriaRaw === 'string'
        ? criteriaRaw.trim()
        : (() => {
            try {
              return JSON.stringify(criteriaRaw)
            } catch {
              return ''
            }
          })()

    if (!criteria) {
      return {
        message: 'Критерії сегмента невалідні. Дай текст або JSON-обʼєкт.',
        actionData: { action: 'create_segment', status: 'invalid_criteria' },
      }
    }

    let computedClientCount: number | null = null
    let parsedCriteriaObj: any = null
    if (typeof criteria === 'string' && criteria.trim().startsWith('{')) {
      try {
        parsedCriteriaObj = JSON.parse(criteria)
      } catch {
        parsedCriteriaObj = null
      }
    }

    // Best-effort: compute clientCount for simple JSON criteria.
    if (parsedCriteriaObj && typeof parsedCriteriaObj === 'object' && !Array.isArray(parsedCriteriaObj)) {
      const where: any = { businessId }

      if (typeof parsedCriteriaObj.status === 'string' && parsedCriteriaObj.status.trim()) {
        where.status = parsedCriteriaObj.status.trim()
      }
      if (typeof parsedCriteriaObj.minVisits === 'number' && Number.isFinite(parsedCriteriaObj.minVisits)) {
        where.totalAppointments = { gte: Math.max(0, Math.floor(parsedCriteriaObj.minVisits)) }
      }
      const minTotalSpentRaw = parsedCriteriaObj.minTotalSpent
      if (
        (typeof minTotalSpentRaw === 'number' && Number.isFinite(minTotalSpentRaw)) ||
        (typeof minTotalSpentRaw === 'string' && /^\d+$/.test(minTotalSpentRaw))
      ) {
        const v = typeof minTotalSpentRaw === 'string' ? BigInt(minTotalSpentRaw) : BigInt(Math.max(0, Math.floor(minTotalSpentRaw)))
        where.totalSpent = { gte: v }
      }
      if (typeof parsedCriteriaObj.lastVisitDays === 'number' && Number.isFinite(parsedCriteriaObj.lastVisitDays)) {
        const days = Math.max(0, Math.floor(parsedCriteriaObj.lastVisitDays))
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        where.lastAppointmentDate = { gte: since }
      }
      if (typeof parsedCriteriaObj.tag === 'string' && parsedCriteriaObj.tag.trim()) {
        // tags stored as JSON string array; this is a best-effort text match.
        where.tags = { contains: `"${parsedCriteriaObj.tag.trim()}"` }
      }

      try {
        computedClientCount = await prisma.client.count({ where })
      } catch {
        computedClientCount = null
      }
    }

    const existing = await prisma.clientSegment.findFirst({
      where: { businessId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true, name: true },
    })

    const segment = existing
      ? await prisma.clientSegment.update({
          where: { id: existing.id },
          data: { name, criteria, autoUpdate, ...(computedClientCount != null ? { clientCount: computedClientCount } : {}) },
          select: { id: true, name: true, autoUpdate: true, updatedAt: true },
        })
      : await prisma.clientSegment.create({
          data: { businessId, name, criteria, autoUpdate, clientCount: computedClientCount ?? 0 },
          select: { id: true, name: true, autoUpdate: true, createdAt: true },
        })

    return {
      message: decision.reply || `Готово. Сегмент "${segment.name}" створено/оновлено.`,
      actionData: {
        action: 'create_segment',
        status: 'completed',
        segment,
        updatedExisting: !!existing,
        ...(computedClientCount != null ? { clientCount: computedClientCount } : {}),
      },
    }
  }

  if (decision.action === 'update_segment') {
    const segmentId = safeText((payload as any).segmentId)
    const name = safeText((payload as any).name)
    const criteriaRaw = (payload as any).criteria

    const segment = segmentId
      ? await prisma.clientSegment.findFirst({ where: { id: segmentId, businessId }, select: { id: true, name: true } })
      : name
        ? await prisma.clientSegment.findFirst({ where: { businessId, name: { contains: name, mode: 'insensitive' } }, select: { id: true, name: true } })
        : null

    if (!segment) {
      return {
        message: decision.reply || 'Не знайшов сегмент. Дай segmentId або name.',
        actionData: { action: 'update_segment', status: 'segment_not_found' },
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name) updateData.name = name
    if (criteriaRaw != null) {
      const criteria =
        typeof criteriaRaw === 'string'
          ? criteriaRaw.trim()
          : (() => {
              try {
                return JSON.stringify(criteriaRaw)
              } catch {
                return null
              }
            })()
      if (criteria) updateData.criteria = criteria
    }

    if (Object.keys(updateData).length === 0) {
      return {
        message: decision.reply || 'Що саме оновити? (name, criteria)',
        actionData: { action: 'update_segment', status: 'missing_fields' },
      }
    }

    const updated = await prisma.clientSegment.update({
      where: { id: segment.id },
      data: updateData as any,
      select: { id: true, name: true, criteria: true, updatedAt: true },
    })

    return {
      message: decision.reply || `Готово. Сегмент "${updated.name}" оновлено.`,
      actionData: { action: 'update_segment', status: 'completed', segment: updated },
    }
  }

  if (decision.action === 'delete_segment') {
    const segmentId = safeText((payload as any).segmentId)
    const segmentName = safeText((payload as any).name)

    const segment = segmentId
      ? await prisma.clientSegment.findFirst({ where: { id: segmentId, businessId }, select: { id: true, name: true } })
      : segmentName
        ? await prisma.clientSegment.findFirst({ where: { businessId, name: { contains: segmentName, mode: 'insensitive' } }, select: { id: true, name: true } })
        : null

    if (!segment) {
      return {
        message: decision.reply || 'Не знайшов сегмент. Дай segmentId або name.',
        actionData: { action: 'delete_segment', status: 'segment_not_found' },
      }
    }

    await prisma.clientSegment.delete({ where: { id: segment.id } })

    return {
      message: decision.reply || `Готово. Сегмент "${segment.name}" видалено.`,
      actionData: { action: 'delete_segment', status: 'completed', segment: { id: segment.id, name: segment.name } },
    }
  }

  if (decision.action === 'update_business') {
    const name = safeText((payload as any).name)
    const description = safeText((payload as any).description)
    const location = safeText((payload as any).location)
    const slogan = safeText((payload as any).slogan)

    const updateData: Record<string, unknown> = {}
    if (name) updateData.name = name
    if (description !== null) updateData.description = description || null
    if (location !== null) updateData.location = location || null
    if (slogan !== null) updateData.slogan = slogan || null

    if (Object.keys(updateData).length === 0) {
      return {
        message: decision.reply || 'Що саме оновити? (name, description, location, slogan)',
        actionData: { action: 'update_business', status: 'missing_fields' },
      }
    }

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: updateData as any,
      select: { id: true, name: true, description: true, location: true, slogan: true },
    })

    return {
      message: decision.reply || `Готово. Профіль бізнесу оновлено.`,
      actionData: { action: 'update_business', status: 'completed', business: updated },
    }
  }

  if (decision.action === 'cancel_appointment') {
    const resolved = await resolveAppointmentForChange()
    if (!resolved) {
      return {
        message: decision.reply || 'Ок. Який запис скасувати? Дай appointmentId або clientPhone (+ за потреби startTime).',
        actionData: { action: 'cancel_appointment', status: 'missing_fields', missing: ['appointmentId|clientPhone'] },
      }
    }

    const updated = await prisma.appointment.update({
      where: { id: resolved.appt.id },
      data: { status: 'Cancelled' },
      select: { id: true, status: true, startTime: true, clientName: true, clientPhone: true },
    })

    return {
      message: decision.reply || 'Готово. Запис скасовано.',
      actionData: { action: 'cancel_appointment', status: 'completed', appointment: updated, resolvedBy: resolved.resolution },
    }
  }

  if (decision.action === 'reschedule_appointment') {
    const newStartTime = parseDateTime((payload as any).newStartTime)
    if (!newStartTime) {
      return {
        message: decision.reply || 'Ок. На який час перенести? (newStartTime ISO)',
        actionData: { action: 'reschedule_appointment', status: 'missing_fields', missing: ['newStartTime'] },
      }
    }

    const resolved = await resolveAppointmentForChange()
    if (!resolved) {
      return {
        message: decision.reply || 'Ок. Який запис переносимо? Дай appointmentId або clientPhone (+ старий startTime).',
        actionData: { action: 'reschedule_appointment', status: 'missing_fields', missing: ['appointmentId|clientPhone'] },
      }
    }

    const durationFromPayload =
      typeof (payload as any).durationMinutes === 'number' && (payload as any).durationMinutes > 0
        ? (payload as any).durationMinutes
        : null
    const durationMinutes = durationFromPayload || Math.max(5, Math.round((resolved.appt.endTime.getTime() - resolved.appt.startTime.getTime()) / 60000))
    const newEndTime = new Date(newStartTime.getTime() + durationMinutes * 60 * 1000)

    const hasConflict = await prisma.appointment.findFirst({
      where: {
        businessId,
        masterId: resolved.appt.masterId,
        startTime: { lt: newEndTime },
        endTime: { gt: newStartTime },
        status: { notIn: ['Cancelled', 'Скасовано'] },
        NOT: { id: resolved.appt.id },
      },
      select: { id: true },
    })
    if (hasConflict) {
      return {
        message: 'Цей час уже зайнятий. Напиши інший час або скажи: "покажи слоти" — я підкажу вільні.',
        actionData: { action: 'reschedule_appointment', status: 'time_conflict', appointmentId: resolved.appt.id },
      }
    }

    const updated = await prisma.appointment.update({
      where: { id: resolved.appt.id },
      data: { startTime: newStartTime, endTime: newEndTime, reminderSent: false },
      select: { id: true, startTime: true, endTime: true, status: true },
    })

    return {
      message: decision.reply || 'Готово. Переніс запис.',
      actionData: { action: 'reschedule_appointment', status: 'completed', appointment: updated, resolvedBy: resolved.resolution },
    }
  }

  if (decision.action === 'update_appointment') {
    const resolved = await resolveAppointmentForChange()
    if (!resolved) {
      return {
        message: decision.reply || 'Ок. Який запис редагуємо? Дай appointmentId або clientPhone (+ startTime).',
        actionData: { action: 'update_appointment', status: 'missing_fields', missing: ['appointmentId|clientPhone'] },
      }
    }

    const nextMasterIdRaw = safeText((payload as any).masterId)
    const nextMasterNameRaw = safeText((payload as any).masterName)?.toLowerCase()
    const nextMaster =
      nextMasterIdRaw || nextMasterNameRaw
        ? business.masters.find((m) => {
            if (nextMasterIdRaw && m.id === nextMasterIdRaw) return true
            if (nextMasterNameRaw && (m.name.toLowerCase().includes(nextMasterNameRaw) || m.id === nextMasterNameRaw)) return true
            return false
          })
        : null

    const nextNotes = safeText((payload as any).notes)
    const nextStatus = safeText((payload as any).status)

    const serviceIds = Array.isArray((payload as any).serviceIds)
      ? ((payload as any).serviceIds as any[]).filter((s) => typeof s === 'string')
      : []
    const serviceNames = Array.isArray((payload as any).serviceNames)
      ? ((payload as any).serviceNames as any[]).filter((s) => typeof s === 'string')
      : []
    const byNames = serviceNames
      .map((n) => n.toLowerCase())
      .map((n) => business.services.find((s) => s.name.toLowerCase().includes(n))?.id)
      .filter((x): x is string => !!x)
    const validServiceIds = [...serviceIds, ...byNames].filter((id) => business.services.some((s) => s.id === id))

    const data: any = {
      ...(nextNotes ? { notes: nextNotes } : {}),
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(nextMaster ? { masterId: nextMaster.id } : {}),
      ...(validServiceIds.length > 0 ? { services: JSON.stringify(validServiceIds) } : {}),
    }

    if (Object.keys(data).length === 0) {
      return {
        message: decision.reply || 'Що саме змінити в записі? (майстер/послуги/нотатки/status)',
        actionData: { action: 'update_appointment', status: 'missing_fields', missing: ['fields_to_update'] },
      }
    }

    const updated = await prisma.appointment.update({
      where: { id: resolved.appt.id },
      data,
      select: { id: true, startTime: true, endTime: true, status: true, masterId: true },
    })

    return {
      message: decision.reply || 'Готово. Оновив запис.',
      actionData: { action: 'update_appointment', status: 'completed', appointment: updated, resolvedBy: resolved.resolution },
    }
  }

  if (decision.action === 'update_business_working_hours') {
    const whRaw = (payload as any).workingHours
    const whJson = toScheduleJson(whRaw)
    if (!whJson) {
      return {
        message: decision.reply || 'Ок. Дай workingHours як JSON (обʼєкт) у форматі як в налаштуваннях графіка.',
        actionData: { action: 'update_business_working_hours', status: 'missing_fields', missing: ['workingHours'] },
      }
    }
    const updated = await prisma.business.update({
      where: { id: businessId },
      data: { workingHours: whJson },
      select: { id: true, workingHours: true, updatedAt: true },
    })
    return {
      message: decision.reply || 'Готово. Оновив графік роботи бізнесу.',
      actionData: { action: 'update_business_working_hours', status: 'completed', business: { id: updated.id, updatedAt: updated.updatedAt } },
    }
  }

  if (decision.action === 'update_master_working_hours') {
    const master = await resolveMasterForChange()
    if (!master) {
      return {
        message: decision.reply || 'Ок. Для якого майстра? (masterId або masterName)',
        actionData: { action: 'update_master_working_hours', status: 'missing_fields', missing: ['masterId|masterName'] },
      }
    }
    const whRaw = (payload as any).workingHours
    const whJson = toScheduleJson(whRaw)
    if (!whJson) {
      return {
        message: decision.reply || 'Ок. Дай workingHours як JSON.',
        actionData: { action: 'update_master_working_hours', status: 'missing_fields', missing: ['workingHours'] },
      }
    }
    const updated = await prisma.master.update({
      where: { id: master.id },
      data: { workingHours: whJson },
      select: { id: true, name: true, updatedAt: true },
    })
    return {
      message: decision.reply || `Готово. Оновив графік майстра "${updated.name}".`,
      actionData: { action: 'update_master_working_hours', status: 'completed', master: updated },
    }
  }

  if (decision.action === 'set_master_date_override') {
    const master = await resolveMasterForChange()
    if (!master) {
      return {
        message: decision.reply || 'Ок. Для якого майстра? (masterId або masterName)',
        actionData: { action: 'set_master_date_override', status: 'missing_fields', missing: ['masterId|masterName'] },
      }
    }
    const dateKey = safeText((payload as any).date)
    const enabled = (payload as any).enabled === true
    const start = safeText((payload as any).start) || '09:00'
    const end = safeText((payload as any).end) || '18:00'
    if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return {
        message: decision.reply || 'Ок. Дай дату у форматі YYYY-MM-DD.',
        actionData: { action: 'set_master_date_override', status: 'missing_fields', missing: ['date'] },
      }
    }

    const current = parseJson<Record<string, any>>(master.scheduleDateOverrides, {})
    const next = { ...(current && typeof current === 'object' && !Array.isArray(current) ? current : {}) }
    next[dateKey] = { enabled, start, end }
    const updated = await prisma.master.update({
      where: { id: master.id },
      data: { scheduleDateOverrides: JSON.stringify(next) },
      select: { id: true, name: true, updatedAt: true },
    })
    return {
      message: decision.reply || `Готово. Виключення на ${dateKey} для "${updated.name}" збережено.`,
      actionData: { action: 'set_master_date_override', status: 'completed', master: updated, date: dateKey, enabled, start, end },
    }
  }

  if (decision.action === 'clear_master_date_override') {
    const master = await resolveMasterForChange()
    if (!master) {
      return {
        message: decision.reply || 'Ок. Для якого майстра? (masterId або masterName)',
        actionData: { action: 'clear_master_date_override', status: 'missing_fields', missing: ['masterId|masterName'] },
      }
    }
    const dateKey = safeText((payload as any).date)
    if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return {
        message: decision.reply || 'Ок. Дай дату у форматі YYYY-MM-DD.',
        actionData: { action: 'clear_master_date_override', status: 'missing_fields', missing: ['date'] },
      }
    }

    const current = parseJson<Record<string, any>>(master.scheduleDateOverrides, {})
    const next = { ...(current && typeof current === 'object' && !Array.isArray(current) ? current : {}) }
    delete next[dateKey]
    const updated = await prisma.master.update({
      where: { id: master.id },
      data: { scheduleDateOverrides: JSON.stringify(next) },
      select: { id: true, name: true, updatedAt: true },
    })
    return {
      message: decision.reply || `Готово. Прибрав виключення на ${dateKey} для "${updated.name}".`,
      actionData: { action: 'clear_master_date_override', status: 'completed', master: updated, date: dateKey },
    }
  }

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

  if (decision.action === 'update_note') {
    const noteId = safeText((payload as any).noteId)
    const text = safeText((payload as any).text)
    const completed = (payload as any).completed
    if (!noteId) {
      return {
        message: decision.reply || 'Ок. Яку нотатку оновити? Дай noteId (з notes_list).',
        actionData: { action: 'update_note', status: 'missing_fields', missing: ['noteId'] },
      }
    }
    const note = await prisma.note.findFirst({ where: { id: noteId, businessId }, select: { id: true, text: true } })
    if (!note) {
      return {
        message: 'Не знайшов нотатку. Перевір noteId.',
        actionData: { action: 'update_note', status: 'note_not_found' },
      }
    }
    const updateData: Record<string, unknown> = {}
    if (text) updateData.text = text
    if (typeof completed === 'boolean') updateData.completed = completed
    if (Object.keys(updateData).length === 0) {
      return {
        message: decision.reply || 'Що саме оновити? (text, completed)',
        actionData: { action: 'update_note', status: 'missing_fields' },
      }
    }
    const updated = await prisma.note.update({
      where: { id: note.id },
      data: updateData as any,
      select: { id: true, text: true, completed: true },
    })
    return {
      message: decision.reply || 'Готово, нотатку оновлено.',
      actionData: { action: 'update_note', status: 'completed', note: updated },
    }
  }

  if (decision.action === 'delete_note') {
    const noteId = safeText((payload as any).noteId)
    if (!noteId) {
      return {
        message: decision.reply || 'Ок. Яку нотатку видалити? Дай noteId (з notes_list).',
        actionData: { action: 'delete_note', status: 'missing_fields', missing: ['noteId'] },
      }
    }
    const note = await prisma.note.findFirst({ where: { id: noteId, businessId }, select: { id: true, text: true } })
    if (!note) {
      return {
        message: 'Не знайшов нотатку. Перевір noteId.',
        actionData: { action: 'delete_note', status: 'note_not_found' },
      }
    }
    await prisma.note.delete({ where: { id: note.id } })
    return {
      message: decision.reply || 'Готово, нотатку видалено.',
      actionData: { action: 'delete_note', status: 'completed', noteId: note.id },
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

  if (decision.action === 'update_reminder') {
    const reminderId = safeText((payload as any).reminderId)
    const msg = safeText((payload as any).message)
    if (!reminderId) {
      return {
        message: decision.reply || 'Ок. Яке нагадування оновити? Дай reminderId (з reminders_list).',
        actionData: { action: 'update_reminder', status: 'missing_fields', missing: ['reminderId'] },
      }
    }
    const rem = await prisma.telegramReminder.findFirst({ where: { id: reminderId, businessId }, select: { id: true } })
    if (!rem) {
      return {
        message: 'Не знайшов нагадування. Перевір reminderId.',
        actionData: { action: 'update_reminder', status: 'reminder_not_found' },
      }
    }
    if (!msg) {
      return {
        message: decision.reply || 'Який текст нагадування встановити?',
        actionData: { action: 'update_reminder', status: 'missing_fields', missing: ['message'] },
      }
    }
    const updated = await prisma.telegramReminder.update({
      where: { id: rem.id },
      data: { message: msg },
      select: { id: true, message: true },
    })
    return {
      message: decision.reply || 'Готово, нагадування оновлено.',
      actionData: { action: 'update_reminder', status: 'completed', reminder: updated },
    }
  }

  if (decision.action === 'delete_reminder') {
    const reminderId = safeText((payload as any).reminderId)
    if (!reminderId) {
      return {
        message: decision.reply || 'Ок. Яке нагадування видалити? Дай reminderId (з reminders_list).',
        actionData: { action: 'delete_reminder', status: 'missing_fields', missing: ['reminderId'] },
      }
    }
    const rem = await prisma.telegramReminder.findFirst({ where: { id: reminderId, businessId }, select: { id: true } })
    if (!rem) {
      return {
        message: 'Не знайшов нагадування. Перевір reminderId.',
        actionData: { action: 'delete_reminder', status: 'reminder_not_found' },
      }
    }
    await prisma.telegramReminder.update({
      where: { id: rem.id },
      data: { status: 'cancelled' },
    })
    return {
      message: decision.reply || 'Готово, нагадування видалено.',
      actionData: { action: 'delete_reminder', status: 'completed', reminderId: rem.id },
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
    const serviceNames = Array.isArray((payload as any).serviceNames)
      ? ((payload as any).serviceNames as unknown[]).filter((s): s is string => typeof s === 'string')
      : []
    const byNames = serviceNames
      .map((n) => n.toLowerCase())
      .map((n) => business.services.find((s) => s.name.toLowerCase().includes(n))?.id)
      .filter((x): x is string => !!x)
    const validServiceIds = serviceIds.filter((id) => business.services.some((s) => s.id === id))
    const mergedServiceIds = [...validServiceIds, ...byNames].filter((id, i, arr) => arr.indexOf(id) === i)
    const selectedService = mergedServiceIds.length > 0
      ? business.services.find((s) => s.id === mergedServiceIds[0])
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
        services: JSON.stringify(mergedServiceIds),
        notes: safeText(payload.notes),
        customServiceName: safeText(payload.customServiceName),
        customPrice: typeof payload.customPrice === 'number' ? payload.customPrice : null,
        isFromBooking: false,
        source: 'ai_agent',
      },
      select: { id: true, startTime: true, endTime: true, masterId: true, status: true },
    })

    const { sendNewAppointmentPush } = await import('@/lib/services/new-appointment-push')
    const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { slug: true } })
    sendNewAppointmentPush(businessId, appointment.id, biz?.slug ?? null, null, clientName, startTime).catch((e) => {
      console.error('Push new appointment (AI):', e)
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

    if (!businessId || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const [aiConfig, business] = await Promise.all([
      getLmStudioConfig(),
      prisma.business.findUnique({
        where: { id: businessId },
        include: {
          services: { where: { isActive: true } },
          masters: { where: { isActive: true } },
        },
      }),
    ])
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const hasAiKey = aiConfig.hasAi
    if (!business.aiChatEnabled) {
      // Don't fail hard: the widget is visible in dashboard for most users.
      return NextResponse.json({
        success: true,
        message:
          'Зараз я офлайн — в мене обідня перерва. Зайди, будь ласка, трохи пізніше.\n\nПідказка: перевір у Центрі управління, що AI увімкнений.',
        action: { action: 'reply', status: 'ai_disabled' },
        ai: {
          hasKey: hasAiKey,
          indicator: 'red',
          usedAi: false,
          reason: 'ai_disabled',
        },
      })
    }

    const hasAiProvider = aiConfig.hasAi
    if (!hasAiProvider) {
      return NextResponse.json({
        success: true,
        message:
          'Зараз я офлайн — в мене обідня перерва. Зайди, будь ласка, трохи пізніше.\n\nПідказка: підключи LM Studio у Центрі управління.',
        action: { action: 'reply', status: 'key_missing' },
        ai: {
          hasKey: false,
          indicator: 'red',
          usedAi: false,
          reason: 'key_missing',
        },
      })
    }

    const [chatHistory, snapshotText] = await Promise.all([
      prisma.aIChatMessage.findMany({
        where: { businessId, sessionId: sessionId || 'default' },
        orderBy: { createdAt: 'asc' },
        take: 6,
      }),
      getBusinessSnapshotText(businessId),
    ])

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
    const aiService =
      aiConfig.baseUrl ? new LmStudioChatService(aiConfig.baseUrl, aiConfig.model) : null
    const isKeyMissing = !aiService

    let decision: AgentDecision | null = null
    let aiUnavailableReason: string | null = null
    let usedAi = false
    let decisionSource: 'llm' | 'heuristic' | 'fallback' | 'explicit' | null = null
    const toolContextParts: string[] = [snapshotText]

    const now = Date.now()
    const cooldownUntil = aiCooldownByBusiness.get(businessId) || 0

    // Fast-path explicit commands to execute actions without LLM variability.
    // Examples: "client: Імʼя, +380...", "service: Назва, 500, 60", "appointment: ...", "note:", "reminder:".
    decision =
      tryBuildExplicitCommandDecision(message, {
        services: business.services.map((s) => ({ id: s.id, name: s.name, duration: s.duration })),
      }) || null
    if (decision) {
      decisionSource = 'explicit'
    }

    // If user sends only a phone as a follow-up, try to finalize booking from previous context.
    if (!decision) {
      const phoneOnly = extractPhoneOnlyMessage(message)
      if (phoneOnly) {
        const fromHistory = tryBuildAppointmentFromRecentHistory({
          messagePhone: phoneOnly,
          history,
          business: { services: business.services.map((s) => ({ name: s.name })) },
        })
        if (fromHistory) {
          decision = fromHistory
          decisionSource = 'heuristic'
        }
      }
    }

    if (!decision && aiService && now < cooldownUntil) {
      aiUnavailableReason = `AI rate-limited (cooldown ${Math.ceil((cooldownUntil - now) / 1000)}s)`
      // User request: when AI is offline/rate-limited, do not attempt heuristics; return a simple message.
      decision = {
        action: 'reply',
        reply: 'Зараз я офлайн — в мене обідня перерва. Зайди, будь ласка, трохи пізніше.',
        confidence: 1,
        payload: { mode: 'offline', reason: 'rate_limited' },
      }
      decisionSource = 'fallback'
    } else if (!decision && aiService) {
      try {
        // Single LLM request. If it asks for a tool, run it and format reply server-side.
        decision = await aiService.getAgentDecision(message, context, history, buildToolContext(toolContextParts))

        if (decision) {
          usedAi = true
          decisionSource = 'llm'
          aiLastSuccessAtByBusiness.set(businessId, Date.now())
        }

        if (decision?.action === 'tool_call' && decision.tool?.name) {
          const toolName = decision.tool.name as AiToolName
          const result = await runAiTool(businessId, toolName, decision.tool.args)
          const toolReply = formatToolResultToReply(result as any)
          decision = {
            action: 'reply',
            reply: toolReply,
            confidence: 0.7,
            needsConfirmation: false,
            payload: { tool: result.tool, data: result.data },
          }
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
    } else if (!decision) {
      aiUnavailableReason = 'AI API key is not configured'
    }

    if (!decision && aiUnavailableReason) {
      // User request: when AI is offline (quota/key/network), do not attempt DB-heuristics.
      decision = {
        action: 'reply',
        reply:
          'Зараз я офлайн — в мене обідня перерва. Зайди, будь ласка, трохи пізніше.\n\nПідказка: якщо це повторюється — перевір ключ/ліміти у Центрі управління.',
        confidence: 1,
        payload: { mode: 'offline', reason: 'ai_unavailable' },
      }
      decisionSource = 'fallback'
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
      assistantMessage = decision.reply || 'Чим можу допомогти? Можу показати KPI, записи, хто працює, клієнтів, нотатки — просто напиши, що потрібно.'
      actionData = { action: 'reply', status: 'completed', confidence: decision.confidence }
    }

    if (aiUnavailableReason) {
      actionData = {
        ...(actionData || {}),
        mode: 'heuristic_fallback',
        aiUnavailableReason: truncateText(aiUnavailableReason, 500),
      }
    }

    if (!assistantMessage.trim()) {
      assistantMessage = 'Щось пішло не так — спробуй ще раз, я тут.'
    }

    // Keep responses compact to reduce token usage and keep the chat snappy.
    assistantMessage = truncateText(assistantMessage.trim(), MAX_ASSISTANT_REPLY_CHARS)

    // Persist a compact usage marker for admin metrics (avoid storing giant provider errors).
    const aiUsage = {
      usedAi,
      source: decisionSource,
      provider: (business.aiProvider || 'lm_studio') as string,
      model: aiConfig.model || 'lm_studio',
      unavailableReason: aiUnavailableReason ? truncateText(aiUnavailableReason, 240) : null,
    }

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
            ai: aiUsage,
            timestamp: new Date().toISOString(),
          }),
        },
      }),
    ])

    const lastOk = aiLastSuccessAtByBusiness.get(businessId) || 0
    const isAiRecentlyOk = Date.now() - lastOk < AI_SUCCESS_TTL_MS
    const indicator: 'green' | 'red' =
      hasAiKey && business.aiChatEnabled && !aiUnavailableReason && (usedAi || isAiRecentlyOk) ? 'green' : 'red'

    return NextResponse.json({
      success: true,
      message: assistantMessage,
      tokens,
      action: actionData,
      ai: {
        hasKey: hasAiKey,
        indicator,
        usedAi,
        reason: aiUnavailableReason ? truncateText(aiUnavailableReason, 500) : decisionSource ? `source:${decisionSource}` : null,
      },
    })
  } catch (error) {
    console.error('AI Chat API error:', error)
    const raw = error instanceof Error ? error.message : 'Failed to process chat message'
    const t = String(raw || '').toLowerCase()
    const safe =
      t.includes('prisma') ||
      t.includes('database') ||
      t.includes('neon.tech') ||
      t.includes("can't reach") ||
      t.includes('econnrefused') ||
      t.includes('etimedout') ||
      t.includes('invocation')
        ? 'Сервіс тимчасово недоступний. Спробуйте через кілька хвилин.'
        : raw
    return NextResponse.json(
      { error: safe },
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
    const lmConfig = await getLmStudioConfig()
    const hasKey = lmConfig.hasAi
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
