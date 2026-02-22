import { prisma } from '@/lib/prisma'
import { toolAnalyticsKpi, toolAppointmentsStats, toolBizOverview, toolPaymentsKpi } from '@/lib/services/ai-data-tools'

type CacheEntry = { value: string; expiresAt: number }

const MEMORY_TTL_MS = 150_000 // Довше кеш = менше перебудов snapshot
const DB_TTL_MS = 24 * 60 * 60 * 1000

declare global {
  // eslint-disable-next-line no-var
  var __aiSnapshotCache: Map<string, CacheEntry> | undefined
}

function cache(): Map<string, CacheEntry> {
  if (!globalThis.__aiSnapshotCache) globalThis.__aiSnapshotCache = new Map()
  return globalThis.__aiSnapshotCache
}

function nowMs(): number {
  return Date.now()
}

function compactJson(obj: unknown, maxChars: number): string {
  let s = ''
  try {
    s = JSON.stringify(obj)
  } catch {
    s = String(obj)
  }
  if (s.length > maxChars) return s.slice(0, maxChars) + '…'
  return s
}

export async function getBusinessSnapshotText(businessId: string): Promise<string> {
  const c = cache()
  const hit = c.get(businessId)
  if (hit && hit.expiresAt > nowMs()) return hit.value

  // Try DB snapshot if fresh enough
  try {
    const existing = await prisma.businessAiSnapshot.findUnique({
      where: { businessId },
      select: { snapshot: true, updatedAt: true },
    })
    if (existing && existing.updatedAt.getTime() > nowMs() - DB_TTL_MS) {
      c.set(businessId, { value: existing.snapshot, expiresAt: nowMs() + MEMORY_TTL_MS })
      return existing.snapshot
    }
  } catch {
    // ignore if table not migrated yet
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(startOfToday)
  endOfToday.setHours(23, 59, 59, 999)

  const [overview, kpi7d, stats7d, payments30d, ops] = await Promise.all([
    toolBizOverview(businessId),
    toolAnalyticsKpi(businessId, { days: 7 }),
    toolAppointmentsStats(businessId, { days: 7 }),
    toolPaymentsKpi(businessId, { days: 30 }),
    Promise.allSettled([
      prisma.socialInboxMessage.count({ where: { businessId, isRead: false } }),
      prisma.telegramReminder.count({ where: { businessId, status: 'pending' } }),
      prisma.note.count({ where: { businessId, date: { gte: startOfToday, lte: endOfToday } } }),
    ]).then((results) => {
      const val = (idx: number): number | null => {
        const r = results[idx]
        return r && r.status === 'fulfilled' ? r.value : null
      }
      return { inboxUnread: val(0), remindersPending: val(1), notesToday: val(2) }
    }),
  ])

  // Compact, token-friendly snapshot string (not pretty JSON)
  const snapshot = [
    `BIZ_OVERVIEW ${compactJson(overview.data, 450)}`,
    `KPI_7D ${compactJson(kpi7d.data, 500)}`,
    `APPT_STATS_7D ${compactJson(stats7d.data, 500)}`,
    `PAYMENTS_30D ${compactJson(payments30d.data, 500)}`,
    `OPS ${compactJson(ops, 120)}`,
  ].join('\n')

  c.set(businessId, { value: snapshot, expiresAt: nowMs() + MEMORY_TTL_MS })
  // Persist in background (don't block response)
  prisma.businessAiSnapshot
    .upsert({
      where: { businessId },
      create: { businessId, snapshot },
      update: { snapshot },
      select: { id: true },
    })
    .catch(() => {})
  return snapshot
}

