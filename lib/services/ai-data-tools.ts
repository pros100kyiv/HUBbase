import { prisma } from '@/lib/prisma'

type DateRange = { start: Date; end: Date }

function clampLimit(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function truncateText(text: string, max: number): string {
  const s = String(text || '')
  if (s.length <= max) return s
  return s.slice(0, Math.max(0, max - 1)) + '…'
}

export type AiToolName =
  | 'biz_overview'
  | 'analytics_kpi'
  | 'appointments_stats'
  | 'appointments_list'
  | 'clients_search'
  | 'client_by_phone'
  | 'client_history'
  | 'segments_list'
  | 'notes_list'
  | 'reminders_list'
  | 'social_inbox_summary'
  | 'payments_kpi'
  | 'services_top'
  | 'masters_top'
  | 'schedule_overview'
  | 'who_working'
  | 'free_slots'
  | 'gaps_summary'

export type AiToolResult = {
  tool: AiToolName
  // Keep payload compact; no huge lists or long text fields.
  data: Record<string, unknown>
}

type DaySchedule = { enabled: boolean; start: string; end: string }
type WorkingHours = Record<string, DaySchedule>
type DateOverrides = Record<string, { enabled: boolean; start: string; end: string }>

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_LABELS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

function parseWorkingHours(raw: string | null | undefined): WorkingHours | null {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null
  try {
    const obj = JSON.parse(raw) as any
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
    return obj as WorkingHours
  } catch {
    return null
  }
}

function parseDateOverrides(raw: string | null | undefined): DateOverrides | null {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null
  try {
    const obj = JSON.parse(raw) as any
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
    return obj as DateOverrides
  } catch {
    return null
  }
}

function getScheduleSummary(workingHours?: string | null): string {
  const hours = parseWorkingHours(workingHours)
  if (!hours) return 'Графік не налаштовано'
  const enabled = DAY_KEYS.filter((key) => hours[key]?.enabled)
  if (enabled.length === 0) return 'Вихідні'
  const first = enabled[0]
  const last = enabled[enabled.length - 1]
  const firstDay = DAY_LABELS_SHORT[DAY_KEYS.indexOf(first)]
  const lastDay = DAY_LABELS_SHORT[DAY_KEYS.indexOf(last)]
  const start = hours[first]?.start ?? '09:00'
  const end = hours[first]?.end ?? '18:00'
  const sameHours = enabled.every((k) => hours[k]?.start === start && hours[k]?.end === end)
  if (sameHours) return `${firstDay}–${lastDay} ${start}–${end}`
  return 'За графіком'
}

function getDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dayKeyFromDate(d: Date): string {
  const js = d.getDay() // 0 Sun .. 6 Sat
  return DAY_KEYS[(js + 6) % 7] // 0->sunday, 1->monday...
}

function getMasterScheduleOnDate(master: { workingHours?: string | null; scheduleDateOverrides?: string | null }, date: Date): {
  enabled: boolean
  start: string
  end: string
  source: 'override' | 'weekly' | 'none'
} | null {
  const dateKey = getDateKey(date)
  const overrides = parseDateOverrides(master.scheduleDateOverrides)
  const override = overrides?.[dateKey]
  if (override !== undefined) {
    return { enabled: override.enabled === true, start: override.start ?? '09:00', end: override.end ?? '18:00', source: 'override' }
  }
  const wh = parseWorkingHours(master.workingHours)
  const dk = dayKeyFromDate(date)
  const day = wh?.[dk]
  if (!day) return { enabled: false, start: '09:00', end: '18:00', source: 'none' }
  return { enabled: day.enabled === true, start: day.start ?? '09:00', end: day.end ?? '18:00', source: 'weekly' }
}

export async function toolScheduleOverview(businessId: string): Promise<AiToolResult> {
  const [business, masters] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { workingHours: true } }),
    prisma.master.findMany({
      where: { businessId, isActive: true },
      orderBy: { createdAt: 'asc' },
      take: 80,
      select: { id: true, name: true, workingHours: true, scheduleDateOverrides: true, isActive: true },
    }),
  ])

  return {
    tool: 'schedule_overview',
    data: {
      business: {
        hasWorkingHours: !!(business?.workingHours && business.workingHours.trim()),
        workingHours: business?.workingHours ? truncateText(business.workingHours, 1200) : null,
      },
      masters: masters.map((m) => ({
        id: m.id,
        name: m.name,
        isActive: m.isActive,
        summary: getScheduleSummary(m.workingHours),
        overridesCount: Object.keys(parseDateOverrides(m.scheduleDateOverrides) || {}).length,
        hasWorkingHours: !!(m.workingHours && m.workingHours.trim()),
      })),
    },
  }
}

export async function toolWhoWorking(businessId: string, args?: Record<string, unknown>): Promise<AiToolResult> {
  const dateStr = String(args?.date ?? '').trim()
  const date = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(`${dateStr}T00:00:00`) : new Date()
  const key = getDateKey(date)

  const masters = await prisma.master.findMany({
    where: { businessId, isActive: true },
    orderBy: { createdAt: 'asc' },
    take: 120,
    select: { id: true, name: true, workingHours: true, scheduleDateOverrides: true },
  })

  const rows = masters.map((m) => {
    const sched = getMasterScheduleOnDate(m, date)
    return {
      id: m.id,
      name: m.name,
      enabled: !!sched?.enabled,
      start: sched?.start ?? null,
      end: sched?.end ?? null,
      source: sched?.source ?? null,
    }
  })

  return {
    tool: 'who_working',
    data: {
      date: key,
      working: rows.filter((r) => r.enabled),
      off: rows.filter((r) => !r.enabled).slice(0, 40),
      totals: { working: rows.filter((r) => r.enabled).length, total: rows.length },
    },
  }
}

export function parseRangeFromArgs(args: Record<string, unknown> | undefined, defaultDays: number): DateRange {
  const now = new Date()
  const days = clampLimit(args?.days, 1, 365, defaultDays)
  const end = new Date(now)
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return { start, end }
}

export async function toolBizOverview(businessId: string): Promise<AiToolResult> {
  const [counts, business] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: {
        _count: { select: { clients: true, masters: true, services: true, appointments: true } },
      },
    }),
    prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        aiChatEnabled: true,
        remindersEnabled: true,
        workingHours: true,
        location: true,
        createdAt: true,
      },
    }),
  ])

  return {
    tool: 'biz_overview',
    data: {
      business: business
        ? {
            id: business.id,
            name: business.name,
            aiChatEnabled: business.aiChatEnabled,
            remindersEnabled: business.remindersEnabled,
            location: business.location || null,
            hasWorkingHours: !!(business.workingHours && business.workingHours.trim()),
            createdAt: business.createdAt,
          }
        : null,
      counts: counts?._count || null,
    },
  }
}

export async function toolAnalyticsKpi(
  businessId: string,
  args?: Record<string, unknown>
): Promise<AiToolResult> {
  const { start, end } = parseRangeFromArgs(args, 7)

  const [appointmentsTotal, appointmentsDone, cancelled, newClients, paymentsSucceeded] =
    await Promise.all([
      prisma.appointment.count({ where: { businessId, startTime: { gte: start, lte: end } } }),
      prisma.appointment.count({
        where: { businessId, startTime: { gte: start, lte: end }, status: { in: ['Done', 'Виконано'] } },
      }),
      prisma.appointment.count({
        where: { businessId, startTime: { gte: start, lte: end }, status: { in: ['Cancelled', 'Скасовано'] } },
      }),
      prisma.client.count({ where: { businessId, createdAt: { gte: start, lte: end } } }),
      prisma.payment.aggregate({
        where: { businessId, createdAt: { gte: start, lte: end }, status: 'succeeded' },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ])

  const revenue = paymentsSucceeded._sum.amount ? Number(paymentsSucceeded._sum.amount) : 0
  const paymentsCount = paymentsSucceeded._count._all

  return {
    tool: 'analytics_kpi',
    data: {
      range: { start, end, days: Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) },
      kpi: {
        appointmentsTotal,
        appointmentsDone,
        cancelled,
        newClients,
        revenue,
        paymentsCount,
        cancelRate: appointmentsTotal > 0 ? cancelled / appointmentsTotal : 0,
      },
    },
  }
}

export async function toolAppointmentsStats(
  businessId: string,
  args?: Record<string, unknown>
): Promise<AiToolResult> {
  const { start, end } = parseRangeFromArgs(args, 7)

  const byStatus = await prisma.appointment.groupBy({
    by: ['status'],
    where: { businessId, startTime: { gte: start, lte: end } },
    _count: { _all: true },
  })

  const byMaster = await prisma.appointment.groupBy({
    by: ['masterId'],
    where: { businessId, startTime: { gte: start, lte: end }, status: { notIn: ['Cancelled', 'Скасовано'] } },
    _count: { _all: true },
    // Prisma does not support ordering by _all in type-safe way; order by masterId count.
    orderBy: { _count: { masterId: 'desc' } },
    take: 5,
  })

  const masters = await prisma.master.findMany({
    where: { businessId, id: { in: byMaster.map((m) => m.masterId) } },
    select: { id: true, name: true },
  })
  const masterNameById = new Map(masters.map((m) => [m.id, m.name]))

  return {
    tool: 'appointments_stats',
    data: {
      range: { start, end },
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      topMasters: byMaster.map((m) => ({
        masterId: m.masterId,
        masterName: masterNameById.get(m.masterId) || null,
        count: m._count._all,
      })),
    },
  }
}

export async function toolMastersTop(businessId: string, args?: Record<string, unknown>): Promise<AiToolResult> {
  const { start, end } = parseRangeFromArgs(args, 30)
  const take = clampLimit(args?.limit, 1, 10, 5)

  const byMaster = await prisma.appointment.groupBy({
    by: ['masterId'],
    where: { businessId, startTime: { gte: start, lte: end }, status: { notIn: ['Cancelled', 'Скасовано'] } },
    _count: { _all: true },
    orderBy: { _count: { masterId: 'desc' } },
    take,
  })

  const masters = await prisma.master.findMany({
    where: { businessId, id: { in: byMaster.map((m) => m.masterId) } },
    select: { id: true, name: true },
  })
  const nameById = new Map(masters.map((m) => [m.id, m.name]))

  return {
    tool: 'masters_top',
    data: {
      range: { start, end },
      rows: byMaster.map((m) => ({
        masterId: m.masterId,
        masterName: nameById.get(m.masterId) || null,
        appointments: m._count._all,
      })),
    },
  }
}

export async function toolAppointmentsList(
  businessId: string,
  args?: Record<string, unknown>
): Promise<AiToolResult> {
  const { start, end } = parseRangeFromArgs(args, 7)
  const limit = clampLimit(args?.limit, 1, 50, 20)

  const rows = await prisma.appointment.findMany({
    where: { businessId, startTime: { gte: start, lte: end } },
    orderBy: { startTime: 'asc' },
    take: limit,
    select: {
      id: true,
      status: true,
      startTime: true,
      endTime: true,
      masterId: true,
      clientName: true,
      clientPhone: true,
      customPrice: true,
      isFromBooking: true,
    },
  })

  return {
    tool: 'appointments_list',
    data: {
      range: { start, end },
      limit,
      rows: rows.map((r) => ({
        id: r.id,
        status: r.status,
        start: r.startTime,
        end: r.endTime,
        masterId: r.masterId,
        client: r.clientName,
        phoneLast4: String(r.clientPhone || '').slice(-4),
        price: r.customPrice ?? null,
        fromBooking: r.isFromBooking,
      })),
    },
  }
}

export async function toolClientsSearch(businessId: string, args?: Record<string, unknown>): Promise<AiToolResult> {
  const q = String(args?.q ?? '').trim()
  const limit = clampLimit(args?.limit, 1, 20, 10)

  if (!q) {
    return { tool: 'clients_search', data: { q: '', limit, rows: [] } }
  }

  const rows = await prisma.client.findMany({
    where: {
      businessId,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      lastAppointmentDate: true,
      totalAppointments: true,
      totalSpent: true,
    },
  })

  return {
    tool: 'clients_search',
    data: {
      q,
      limit,
      rows: rows.map((c) => ({
        id: c.id,
        name: c.name,
        phoneLast4: c.phone.slice(-4),
        status: c.status,
        lastVisit: c.lastAppointmentDate,
        totalAppointments: c.totalAppointments,
        totalSpent: Number(c.totalSpent || 0),
      })),
    },
  }
}

export async function toolClientByPhone(businessId: string, args?: Record<string, unknown>): Promise<AiToolResult> {
  const phone = String(args?.phone ?? '').trim()
  if (!phone) return { tool: 'client_by_phone', data: { phone: '', client: null } }

  const normalized = normalizeUaMaybe(phone)
  const client = await prisma.client.findUnique({
    where: { businessId_phone: { businessId, phone: normalized } },
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      lastAppointmentDate: true,
      totalAppointments: true,
      totalSpent: true,
    },
  })

  return {
    tool: 'client_by_phone',
    data: {
      phone: normalized,
      client: client
        ? {
            id: client.id,
            name: client.name,
            phoneLast4: client.phone.slice(-4),
            status: client.status,
            lastVisit: client.lastAppointmentDate,
            totalAppointments: client.totalAppointments,
            totalSpent: Number(client.totalSpent || 0),
          }
        : null,
    },
  }
}

export async function toolClientHistory(businessId: string, args?: Record<string, unknown>): Promise<AiToolResult> {
  const clientId = String(args?.clientId ?? '').trim()
  const limit = clampLimit(args?.limit, 1, 30, 10)
  if (!clientId) return { tool: 'client_history', data: { clientId: '', appointments: [] } }

  const [client, appointments, payments] = await Promise.all([
    prisma.client.findFirst({
      where: { id: clientId, businessId },
      select: { id: true, name: true, phone: true, status: true, totalAppointments: true, totalSpent: true, lastAppointmentDate: true },
    }),
    prisma.appointment.findMany({
      where: { businessId, clientId },
      orderBy: { startTime: 'desc' },
      take: limit,
      select: { id: true, startTime: true, endTime: true, status: true, masterId: true, customPrice: true, procedureDone: true },
    }),
    prisma.payment.aggregate({
      where: { businessId, clientId, status: 'succeeded' },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ])

  return {
    tool: 'client_history',
    data: {
      client: client
        ? {
            id: client.id,
            name: client.name,
            phoneLast4: client.phone.slice(-4),
            status: client.status,
            totalAppointments: client.totalAppointments,
            totalSpent: Number(client.totalSpent || 0),
            lastVisit: client.lastAppointmentDate,
            paymentsSucceeded: payments._count._all,
            paymentsRevenue: payments._sum.amount ? Number(payments._sum.amount) : 0,
          }
        : null,
      appointments: appointments.map((a) => ({
        id: a.id,
        start: a.startTime,
        status: a.status,
        masterId: a.masterId,
        price: a.customPrice ?? null,
        // Keep this tiny: just signal presence, not the full text
        hasProcedureDone: !!(a.procedureDone && a.procedureDone.trim()),
      })),
    },
  }
}

export async function toolSegmentsList(businessId: string): Promise<AiToolResult> {
  const rows = await prisma.clientSegment.findMany({
    where: { businessId },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: { id: true, name: true, clientCount: true, autoUpdate: true, updatedAt: true },
  })
  return { tool: 'segments_list', data: { rows } }
}

export async function toolNotesList(businessId: string, args?: Record<string, unknown>): Promise<AiToolResult> {
  const limit = clampLimit(args?.limit, 1, 50, 20)
  const dateStr = String(args?.date ?? '').trim()
  let where: any = { businessId }
  if (dateStr) {
    const d = new Date(dateStr)
    if (!Number.isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0)
      const end = new Date(d)
      end.setHours(23, 59, 59, 999)
      where = { businessId, date: { gte: d, lte: end } }
    }
  }
  const rows = await prisma.note.findMany({
    where,
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    take: limit,
    select: { id: true, text: true, completed: true, date: true, order: true, createdAt: true },
  })
  return {
    tool: 'notes_list',
    data: {
      date: dateStr || null,
      limit,
      rows: rows.map((n) => ({
        id: n.id,
        text: n.text.length > 140 ? n.text.slice(0, 140) + '…' : n.text,
        completed: n.completed,
        date: n.date,
        order: n.order,
      })),
    },
  }
}

export async function toolRemindersList(businessId: string, args?: Record<string, unknown>): Promise<AiToolResult> {
  const limit = clampLimit(args?.limit, 1, 50, 20)
  const status = String(args?.status ?? '').trim() || undefined
  const where: any = { businessId, ...(status ? { status } : {}) }
  const rows = await prisma.telegramReminder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, status: true, targetType: true, scheduledAt: true, createdAt: true, message: true, clientId: true },
  })
  return {
    tool: 'reminders_list',
    data: {
      status: status || null,
      limit,
      rows: rows.map((r) => ({
        id: r.id,
        status: r.status,
        targetType: r.targetType,
        scheduledAt: r.scheduledAt,
        clientId: r.clientId,
        message: r.message.length > 140 ? r.message.slice(0, 140) + '…' : r.message,
      })),
    },
  }
}

export async function toolSocialInboxSummary(businessId: string, args?: Record<string, unknown>): Promise<AiToolResult> {
  const limit = clampLimit(args?.limit, 1, 50, 20)
  const platform = String(args?.platform ?? '').trim() || undefined

  const where: any = { businessId, ...(platform ? { platform } : {}) }
  const [unreadCount, rows] = await Promise.all([
    prisma.socialInboxMessage.count({ where: { ...where, isRead: false } }),
    prisma.socialInboxMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, platform: true, direction: true, senderName: true, isRead: true, createdAt: true, message: true },
    }),
  ])

  return {
    tool: 'social_inbox_summary',
    data: {
      platform: platform || null,
      unreadCount,
      limit,
      rows: rows.map((m) => ({
        id: m.id,
        platform: m.platform,
        dir: m.direction,
        sender: m.senderName,
        unread: !m.isRead,
        at: m.createdAt,
        preview: m.message.length > 120 ? m.message.slice(0, 120) + '…' : m.message,
      })),
    },
  }
}

export async function toolPaymentsKpi(businessId: string, args?: Record<string, unknown>): Promise<AiToolResult> {
  const { start, end } = parseRangeFromArgs(args, 30)
  const byStatus = await prisma.payment.groupBy({
    by: ['status'],
    where: { businessId, createdAt: { gte: start, lte: end } },
    _count: { _all: true },
    _sum: { amount: true },
  })
  return {
    tool: 'payments_kpi',
    data: {
      range: { start, end },
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
        sum: s._sum.amount ? Number(s._sum.amount) : 0,
      })),
    },
  }
}

export async function toolServicesTop(businessId: string, args?: Record<string, unknown>): Promise<AiToolResult> {
  const { start, end } = parseRangeFromArgs(args, 30)
  const limit = clampLimit(args?.limit, 1, 10, 5)

  // services stored as JSON string array; use SQL to unnest and count.
  const rows = await prisma.$queryRaw<Array<{ service_id: string; cnt: bigint }>>`
    SELECT service_id, COUNT(*)::bigint AS cnt
    FROM (
      SELECT jsonb_array_elements_text(services::jsonb) AS service_id
      FROM "Appointment"
      WHERE "businessId" = ${businessId}
        AND "startTime" >= ${start}
        AND "startTime" <= ${end}
        AND "status" NOT IN ('Cancelled', 'Скасовано')
    ) s
    GROUP BY service_id
    ORDER BY cnt DESC
    LIMIT ${limit};
  `

  const serviceIds = rows.map((r) => r.service_id)
  const services = await prisma.service.findMany({
    where: { businessId, id: { in: serviceIds } },
    select: { id: true, name: true, price: true, duration: true },
  })
  const byId = new Map(services.map((s) => [s.id, s]))

  return {
    tool: 'services_top',
    data: {
      range: { start, end },
      rows: rows.map((r) => ({
        serviceId: r.service_id,
        name: byId.get(r.service_id)?.name || null,
        count: Number(r.cnt || 0),
      })),
    },
  }
}

function normalizeUaMaybe(phone: string): string {
  // Keep this tiny and dependency-free. If already in +380... format, keep.
  const p = phone.trim()
  if (p.startsWith('+')) return p
  if (p.startsWith('380')) return `+${p}`
  if (p.startsWith('0') && p.length >= 10) return `+38${p}`
  return p
}

function timeToHours(s: string): number {
  const [h, m] = String(s || '').split(':').map((x) => parseInt(x, 10) || 0)
  return h + m / 60
}

function getWindowsForDateKey(
  dateKey: string,
  master: { workingHours?: string | null; scheduleDateOverrides?: string | null }
): Array<{ start: number; end: number }> | null {
  const date = new Date(`${dateKey}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const overrides = parseDateOverrides(master.scheduleDateOverrides)
  const override = overrides?.[dateKey]
  if (override !== undefined) {
    if (!override.enabled) return null
    const start = timeToHours(override.start)
    const end = timeToHours(override.end)
    if (start >= end) return null
    return [{ start: Math.max(0, start), end: Math.min(24, end) }]
  }
  const wh = parseWorkingHours(master.workingHours)
  const dk = dayKeyFromDate(date)
  const day = wh?.[dk]
  if (!day?.enabled) return null
  const start = timeToHours(day.start || '09:00')
  const end = timeToHours(day.end || '18:00')
  if (start >= end) return null
  return [{ start: Math.max(0, start), end: Math.min(24, end) }]
}

async function resolveMasterForScheduleTool(
  businessId: string,
  args?: Record<string, unknown>
): Promise<{ id: string; name: string; workingHours: string | null; scheduleDateOverrides: string | null } | null> {
  const masterId = typeof args?.masterId === 'string' ? args.masterId.trim() : ''
  const masterName = typeof args?.masterName === 'string' ? args.masterName.trim() : ''
  if (masterId) {
    return prisma.master.findFirst({
      where: { businessId, id: masterId, isActive: true },
      select: { id: true, name: true, workingHours: true, scheduleDateOverrides: true },
    })
  }
  if (masterName) {
    return prisma.master.findFirst({
      where: { businessId, isActive: true, name: { contains: masterName, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, workingHours: true, scheduleDateOverrides: true },
    })
  }
  return null
}

export async function toolFreeSlots(businessId: string, args?: Record<string, unknown>): Promise<AiToolResult> {
  const dateKey = typeof args?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.date.trim())
    ? args.date.trim()
    : getDateKey(new Date())
  const durationMinutes = clampLimit(args?.durationMinutes, 5, 360, 60)
  const limit = clampLimit(args?.limit, 1, 80, 24)
  const slotStepMinutes = 30

  const master = await resolveMasterForScheduleTool(businessId, args)
  if (!master) {
    return {
      tool: 'free_slots',
      data: {
        date: dateKey,
        durationMinutes,
        error: 'master_required',
        hint: 'Provide masterId or masterName',
      },
    }
  }

  const windows = getWindowsForDateKey(dateKey, master)
  if (!windows || windows.length === 0) {
    return { tool: 'free_slots', data: { date: dateKey, durationMinutes, master: { id: master.id, name: master.name }, slots: [] } }
  }

  const startOfDay = new Date(`${dateKey}T00:00:00`)
  const endOfDay = new Date(`${dateKey}T23:59:59`)
  const appts = await prisma.appointment.findMany({
    where: {
      businessId,
      masterId: master.id,
      startTime: { lt: endOfDay },
      endTime: { gt: startOfDay },
      status: { notIn: ['Cancelled', 'Скасовано'] },
    },
    orderBy: { startTime: 'asc' },
    select: { startTime: true, endTime: true },
  })

  const busy: Array<{ startMin: number; endMin: number }> = appts.map((a) => ({
    startMin: a.startTime.getHours() * 60 + a.startTime.getMinutes(),
    endMin: a.endTime.getHours() * 60 + a.endTime.getMinutes(),
  }))

  const isFree = (startMin: number, endMin: number): boolean => {
    for (const b of busy) {
      if (startMin < b.endMin && endMin > b.startMin) return false
    }
    return true
  }

  const slots: string[] = []
  for (const w of windows) {
    const winStartMin = Math.round(w.start * 60)
    const winEndMin = Math.round(w.end * 60)
    for (let t = winStartMin; t + durationMinutes <= winEndMin; t += slotStepMinutes) {
      if (isFree(t, t + durationMinutes)) {
        const hh = String(Math.floor(t / 60)).padStart(2, '0')
        const mm = String(t % 60).padStart(2, '0')
        slots.push(`${dateKey}T${hh}:${mm}`)
        if (slots.length >= limit) break
      }
    }
    if (slots.length >= limit) break
  }

  return {
    tool: 'free_slots',
    data: {
      date: dateKey,
      durationMinutes,
      master: { id: master.id, name: master.name },
      slots,
      totalBusy: busy.length,
    },
  }
}

export async function toolGapsSummary(businessId: string, args?: Record<string, unknown>): Promise<AiToolResult> {
  const dateKey = typeof args?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.date.trim())
    ? args.date.trim()
    : getDateKey(new Date())
  const minGapMinutes = clampLimit(args?.minGapMinutes, 10, 360, 30)
  const limit = clampLimit(args?.limit, 1, 30, 10)

  const master = await resolveMasterForScheduleTool(businessId, args)
  if (!master) {
    return { tool: 'gaps_summary', data: { date: dateKey, error: 'master_required', hint: 'Provide masterId or masterName' } }
  }

  const windows = getWindowsForDateKey(dateKey, master)
  if (!windows || windows.length === 0) {
    return { tool: 'gaps_summary', data: { date: dateKey, master: { id: master.id, name: master.name }, gaps: [], note: 'no_working_hours' } }
  }

  const startOfDay = new Date(`${dateKey}T00:00:00`)
  const endOfDay = new Date(`${dateKey}T23:59:59`)
  const appts = await prisma.appointment.findMany({
    where: {
      businessId,
      masterId: master.id,
      startTime: { lt: endOfDay },
      endTime: { gt: startOfDay },
      status: { notIn: ['Cancelled', 'Скасовано'] },
    },
    orderBy: { startTime: 'asc' },
    select: { startTime: true, endTime: true, status: true, clientName: true },
  })

  const toMin = (d: Date) => d.getHours() * 60 + d.getMinutes()
  const busy = appts.map((a) => ({ s: toMin(a.startTime), e: toMin(a.endTime), status: a.status, client: a.clientName }))

  const gaps: Array<{ start: string; end: string; minutes: number }> = []
  const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

  for (const w of windows) {
    const ws = Math.round(w.start * 60)
    const we = Math.round(w.end * 60)
    const inWindow = busy.filter((b) => b.e > ws && b.s < we).map((b) => ({ s: Math.max(ws, b.s), e: Math.min(we, b.e) }))
    inWindow.sort((a, b) => a.s - b.s)

    let cur = ws
    for (const b of inWindow) {
      if (b.s > cur) {
        const len = b.s - cur
        if (len >= minGapMinutes) gaps.push({ start: fmt(cur), end: fmt(b.s), minutes: len })
      }
      cur = Math.max(cur, b.e)
    }
    if (we > cur) {
      const len = we - cur
      if (len >= minGapMinutes) gaps.push({ start: fmt(cur), end: fmt(we), minutes: len })
    }
  }

  gaps.sort((a, b) => b.minutes - a.minutes)

  return {
    tool: 'gaps_summary',
    data: {
      date: dateKey,
      master: { id: master.id, name: master.name },
      minGapMinutes,
      gaps: gaps.slice(0, limit),
      totalGaps: gaps.length,
      totalAppointments: appts.length,
    },
  }
}

export async function runAiTool(businessId: string, name: AiToolName, args?: Record<string, unknown>): Promise<AiToolResult> {
  switch (name) {
    case 'biz_overview':
      return toolBizOverview(businessId)
    case 'analytics_kpi':
      return toolAnalyticsKpi(businessId, args)
    case 'appointments_stats':
      return toolAppointmentsStats(businessId, args)
    case 'appointments_list':
      return toolAppointmentsList(businessId, args)
    case 'clients_search':
      return toolClientsSearch(businessId, args)
    case 'client_by_phone':
      return toolClientByPhone(businessId, args)
    case 'client_history':
      return toolClientHistory(businessId, args)
    case 'segments_list':
      return toolSegmentsList(businessId)
    case 'notes_list':
      return toolNotesList(businessId, args)
    case 'reminders_list':
      return toolRemindersList(businessId, args)
    case 'social_inbox_summary':
      return toolSocialInboxSummary(businessId, args)
    case 'payments_kpi':
      return toolPaymentsKpi(businessId, args)
    case 'services_top':
      return toolServicesTop(businessId, args)
    case 'masters_top':
      return toolMastersTop(businessId, args)
    case 'schedule_overview':
      return toolScheduleOverview(businessId)
    case 'who_working':
      return toolWhoWorking(businessId, args)
    case 'free_slots':
      return toolFreeSlots(businessId, args)
    case 'gaps_summary':
      return toolGapsSummary(businessId, args)
  }
}

