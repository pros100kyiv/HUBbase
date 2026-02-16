'use client'

import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export type VisitTone = 'done' | 'confirmed' | 'pending' | 'cancelled' | 'other'

export interface VisitHistoryItem {
  id: string
  startTime: string | Date
  endTime: string | Date
  statusLabel: string
  tone?: VisitTone
  masterName?: string | null
  services?: string[]
  amountGrn?: number | null
  notes?: string | null
}

function toDate(v: string | Date): Date {
  const d = v instanceof Date ? v : new Date(v)
  return Number.isFinite(d.getTime()) ? d : new Date()
}

function toneRowBorder(tone: VisitTone): string {
  switch (tone) {
    case 'done':
      return 'border-l-sky-500/70'
    case 'confirmed':
      return 'border-l-emerald-500/70'
    case 'pending':
      return 'border-l-amber-500/70'
    case 'cancelled':
      return 'border-l-rose-500/60'
    default:
      return 'border-l-white/20'
  }
}

function toneBadgeClass(tone: VisitTone): string {
  switch (tone) {
    case 'done':
      return 'bg-sky-500/15 text-sky-200 border-sky-400/30'
    case 'confirmed':
      return 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
    case 'pending':
      return 'bg-amber-500/15 text-amber-200 border-amber-400/30'
    case 'cancelled':
      return 'bg-rose-500/15 text-rose-200 border-rose-400/30'
    default:
      return 'bg-white/10 text-gray-200 border-white/20'
  }
}

export function VisitHistorySections({
  items,
  emptyText = 'Немає записів',
  maxServices = 2,
  className,
}: {
  items: VisitHistoryItem[]
  emptyText?: string
  maxServices?: number
  className?: string
}) {
  if (!items || items.length === 0) {
    return (
      <div className={cn('py-8 text-center text-xs text-gray-400 rounded-lg border border-dashed border-white/10 bg-white/5', className)}>
        {emptyText}
      </div>
    )
  }

  const sections: Array<{ dayKey: string; dayDate: Date; items: VisitHistoryItem[] }> = []
  for (const it of items) {
    const start = toDate(it.startTime)
    const dayKey = format(start, 'yyyy-MM-dd')
    const last = sections[sections.length - 1]
    if (!last || last.dayKey !== dayKey) {
      sections.push({ dayKey, dayDate: start, items: [it] })
    } else {
      last.items.push(it)
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      {sections.map((section) => (
        <div key={section.dayKey} className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-white/10 bg-white/5">
            <span className="text-xs font-semibold text-white tabular-nums">
              {format(section.dayDate, 'dd.MM.yyyy')}
            </span>
            <span className="text-[11px] text-gray-400 capitalize">
              {format(section.dayDate, 'EEEE', { locale: uk })}
            </span>
          </div>

          <div className="divide-y divide-white/10">
            {section.items.map((it) => {
              const start = toDate(it.startTime)
              const end = toDate(it.endTime)
              const tone = it.tone ?? 'other'
              const services = Array.isArray(it.services) ? it.services.filter(Boolean) : []
              const visible = services.slice(0, Math.max(0, maxServices))
              const rest = Math.max(0, services.length - visible.length)

              return (
                <div
                  key={it.id}
                  className={cn(
                    'px-3 py-2.5 hover:bg-white/[0.06] transition-colors border-l-4',
                    toneRowBorder(tone)
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white tabular-nums">
                          {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
                        </span>
                        <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium border', toneBadgeClass(tone))}>
                          {it.statusLabel}
                        </span>
                        {it.masterName && (
                          <span className="text-[11px] text-gray-400 truncate">
                            {it.masterName}
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {visible.length > 0 ? (
                          <>
                            {visible.map((name, idx) => (
                              <span
                                key={`${it.id}-svc-${idx}`}
                                className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-white/10 text-gray-200 border border-white/10"
                              >
                                {name}
                              </span>
                            ))}
                            {rest > 0 && (
                              <span className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-white/5 text-gray-400 border border-white/10">
                                +{rest}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-gray-500">Послуги не вказані</span>
                        )}
                      </div>

                      {it.notes && (
                        <p className="text-[11px] text-gray-500 italic mt-1.5 line-clamp-1">
                          {it.notes}
                        </p>
                      )}
                    </div>

                           {it.amountGrn != null && it.amountGrn > 0 && (
                             <div className="flex-shrink-0 text-sm font-semibold text-emerald-400 tabular-nums">
                        {Math.round(it.amountGrn)} грн
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

