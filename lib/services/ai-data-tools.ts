import { prisma } from '@/lib/prisma'

type DateRange = { start: Date; end: Date }

function clampLimit(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
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

export type AiToolResult = {
  tool: AiToolName
  // Keep payload compact; no huge lists or long text fields.
  data: Record<string, unknown>
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
  }
}

