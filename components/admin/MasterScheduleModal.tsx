'use client'

import { useEffect, useState } from 'react'
import { XIcon, CheckIcon } from '@/components/icons'
import { ModalPortal } from '@/components/ui/modal-portal'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'
import { ErrorToast } from '@/components/ui/error-toast'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
} from 'date-fns'
import { uk } from 'date-fns/locale'

interface MasterScheduleModalProps {
  master: {
    id: string
    name: string
    workingHours?: string | null
    scheduleDateOverrides?: string | null
  }
  businessId: string
  otherMasters?: Array<{ id: string; name: string }>
  /** When provided, open the editor for this date key (YYYY-MM-DD) on mount. */
  initialEditingDateKey?: string | null
  onClose: () => void
  onSave: (workingHours?: string, scheduleDateOverrides?: string) => void
}

type DateOverride = {
  enabled: boolean
  start: string
  end: string
  breakStart?: string
  breakEnd?: string
}

type DateOverridesMap = Record<string, DateOverride>

function timeShort(t: string): string {
  return t?.slice(0, 5) || '—'
}

function timeToMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || '')
  if (!m) return Number.NaN
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return Number.NaN
  return hh * 60 + mm
}

export function MasterScheduleModal({
  master,
  businessId,
  initialEditingDateKey = null,
  onClose,
  onSave,
}: MasterScheduleModalProps) {
  const [scheduleDateOverrides, setScheduleDateOverrides] = useState<DateOverridesMap>({})
  const [overridesLoaded, setOverridesLoaded] = useState(false)
  const [monthDate, setMonthDate] = useState(() => new Date())
  const [editingDateKey, setEditingDateKey] = useState<string | null>(null)
  const [editOverride, setEditOverride] = useState<DateOverride>({ enabled: true, start: '09:00', end: '18:00' })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showErrorToast, setShowErrorToast] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    try {
      const parsed =
        master.scheduleDateOverrides
          ? (typeof master.scheduleDateOverrides === 'string'
            ? JSON.parse(master.scheduleDateOverrides)
            : master.scheduleDateOverrides)
          : {}
      setScheduleDateOverrides(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {})
      setOverridesLoaded(true)
    } catch (e) {
      console.error('Error parsing scheduleDateOverrides:', e)
      setScheduleDateOverrides({})
      setOverridesLoaded(true)
    }
  }, [master.scheduleDateOverrides])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (editingDateKey) setEditingDateKey(null)
        else onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editingDateKey, onClose])

  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getOverrideForDate = (dateKey: string): DateOverride | null => scheduleDateOverrides[dateKey] ?? null

  const setOverrideForDate = (dateKey: string, value: DateOverride | null) => {
    if (value === null) {
      setScheduleDateOverrides((prev) => {
        const next = { ...prev }
        delete next[dateKey]
        return next
      })
    } else {
      setScheduleDateOverrides((prev) => ({ ...prev, [dateKey]: value }))
    }
    setEditingDateKey(null)
  }

  const openEditorForDate = (dateKey: string) => {
    setEditingDateKey(dateKey)
    const existing = getOverrideForDate(dateKey)
    setEditOverride(existing ?? { enabled: true, start: '09:00', end: '18:00' })
  }

  // Open a specific date editor when the modal is opened from "Week overview".
  // Run once per mount to avoid re-opening after user closes the editor.
  const [didInitEditingDate, setDidInitEditingDate] = useState(false)
  useEffect(() => {
    if (didInitEditingDate) return
    if (!initialEditingDateKey) return
    if (!overridesLoaded) return
    const d = new Date(`${initialEditingDateKey}T00:00:00`)
    if (!Number.isFinite(d.getTime())) return
    setDidInitEditingDate(true)
    setMonthDate(d)
    openEditorForDate(initialEditingDateKey)
  }, [didInitEditingDate, initialEditingDateKey, overridesLoaded])

  const validateOverride = (o: DateOverride): { ok: true } | { ok: false; message: string } => {
    if (!o.enabled) return { ok: true }
    const startMin = timeToMinutes(o.start)
    const endMin = timeToMinutes(o.end)
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) {
      return { ok: false, message: 'Перевірте початок/кінець' }
    }
    const hasBreak = o.breakStart != null && o.breakEnd != null
    if (hasBreak) {
      const bs = timeToMinutes(o.breakStart || '')
      const be = timeToMinutes(o.breakEnd || '')
      if (!Number.isFinite(bs) || !Number.isFinite(be) || be <= bs) {
        return { ok: false, message: 'Перевірте час перерви' }
      }
      if (bs < startMin || be > endMin) {
        return { ok: false, message: 'Перерва має бути в межах робочого часу' }
      }
    }
    return { ok: true }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setShowErrorToast(false)

    try {
      // Important: do NOT wipe the weekly schedule when saving overrides.
      // Week overview and other parts of the UI depend on `workingHours` when it exists.
      const workingHoursJson =
        typeof master.workingHours === 'string' && master.workingHours.trim()
          ? master.workingHours
          : '{}'
      const scheduleDateOverridesJson = JSON.stringify(scheduleDateOverrides)

      const response = await fetch(`/api/masters/${master.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          workingHours: workingHoursJson,
          scheduleDateOverrides: scheduleDateOverridesJson,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error((error as { error?: string })?.error || 'Не вдалося зберегти графік')
      }

      toast({ title: 'Успішно!', description: 'Графік роботи оновлено', type: 'success' })
      onSave(workingHoursJson, scheduleDateOverridesJson)
      onClose()
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Не вдалося зберегти графік'
      setErrorMessage(errorMsg)
      setShowErrorToast(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const editingDate = editingDateKey ? new Date(`${editingDateKey}T00:00:00`) : null
  const hasBreak = editOverride.breakStart != null && editOverride.breakEnd != null

  return (
    <ModalPortal>
      <div className="modal-overlay sm:!p-4 p-3" onClick={onClose} role="presentation">
        <div
          className="relative w-full max-w-[min(100%,28rem)] sm:max-w-xl sm:my-auto modal-content modal-dialog text-white h-[85dvh] max-h-[85dvh] sm:h-auto sm:max-h-[85dvh] flex flex-col min-h-0 rounded-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 z-10 p-2.5 -m-2.5 touch-target min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30 rounded-xl"
            aria-label="Закрити"
          >
            <XIcon className="w-5 h-5" />
          </button>

          <div className="pt-4 sm:pt-6 px-4 sm:px-6 pb-3 flex-shrink-0 pr-14">
            <h2 className="text-lg sm:text-xl font-bold text-white">Графік роботи</h2>
            <p className="text-sm text-gray-400 truncate mt-0.5">{master.name}</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 sm:px-6 pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                <div className="p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setMonthDate(subMonths(monthDate, 1))}
                      className="min-h-[44px] min-w-[44px] p-2 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 active:bg-white/15 text-base touch-target flex items-center justify-center"
                      aria-label="Попередній місяць"
                    >
                      ←
                    </button>
                    <span className="text-sm font-semibold text-white capitalize">
                      {format(monthDate, 'LLLL yyyy', { locale: uk })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMonthDate(addMonths(monthDate, 1))}
                      className="min-h-[44px] min-w-[44px] p-2 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 active:bg-white/15 text-base touch-target flex items-center justify-center"
                      aria-label="Наступний місяць"
                    >
                      →
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                      <span className="w-2 h-2 rounded-full bg-white/30" />
                      Не налаштовано
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Робочий день
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
                      <span className="w-2 h-2 rounded-full bg-rose-400" />
                      Вихідний
                    </span>
                    <span>Клік по даті — налаштувати</span>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-1 min-w-0" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((d) => (
                      <div key={d} className="text-center text-[10px] font-semibold text-gray-500 py-1 truncate min-w-0">{d}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1 min-w-0" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                    {calendarDays.map((day) => {
                      const inMonth = isSameMonth(day, monthDate)
                      const dateKey = format(day, 'yyyy-MM-dd')
                      const override = getOverrideForDate(dateKey)
                      const isConfigured = override != null
                      const isWorking = override?.enabled === true
                      const isDayOff = override?.enabled === false
                      const label = !isConfigured ? '—' : isWorking ? `${timeShort(override.start)}–${timeShort(override.end)}` : 'Вих.'

                      return (
                        <button
                          key={dateKey}
                          type="button"
                          disabled={!inMonth}
                          onClick={() => openEditorForDate(dateKey)}
                          title={inMonth ? format(day, 'd MMM', { locale: uk }) : ''}
                          className={cn(
                            'w-full min-h-[44px] sm:min-h-[38px] py-1.5 rounded-lg text-[11px] font-medium transition-colors flex flex-col items-center justify-center leading-tight touch-target',
                            !inMonth && 'opacity-25 cursor-default',
                            inMonth && !isConfigured && 'bg-white/[0.03] border border-white/10 text-gray-400 hover:bg-white/[0.06] hover:border-white/15',
                            inMonth && isWorking && 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-100 hover:bg-emerald-500/20',
                            inMonth && isDayOff && 'bg-rose-500/15 border border-rose-500/20 text-rose-200 hover:bg-rose-500/20',
                            inMonth && 'active:scale-95'
                          )}
                        >
                          <span>{format(day, 'd')}</span>
                          {inMonth && (
                            <span className="text-[9px] opacity-80 truncate max-w-full tabular-nums">
                              <span className="sm:hidden">{label.replace(':00', '').replace(':00', '')}</span>
                              <span className="hidden sm:inline">{label}</span>
                            </span>
                          )}
                          {inMonth && isWorking && override?.breakStart && override?.breakEnd && (
                            <span className="text-[8px] opacity-70 tabular-nums">
                              {timeShort(override.breakStart)}–{timeShort(override.breakEnd)}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-4 sm:px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/10 bg-black/20 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[48px] px-4 py-3 text-sm font-medium rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 active:bg-white/15 transition-colors touch-target"
              >
                Скасувати
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 min-h-[48px] px-4 py-3 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg touch-target"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Збереження...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    Зберегти
                  </>
                )}
              </button>
            </div>
          </form>

          {editingDateKey && (
            <>
              <div className="fixed inset-0 bg-black/50 z-[55]" aria-hidden onClick={() => setEditingDateKey(null)} />
              <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] p-4 rounded-xl bg-[#1f1f1f] border border-white/20 shadow-2xl w-[min(calc(100vw-2rem),340px)] max-h-[min(85vh,520px)] overflow-y-auto overscroll-contain">
                <div className="text-sm font-semibold text-white mb-1">
                  {editingDate && Number.isFinite(editingDate.getTime()) ? format(editingDate, 'd MMMM yyyy', { locale: uk }) : editingDateKey}
                </div>
                <div className="text-[11px] text-gray-400 mb-3">Встановіть години роботи та перерву для цієї дати</div>

                <label className="flex items-center gap-2 mb-3 min-h-[44px] cursor-pointer touch-target">
                  <input
                    type="checkbox"
                    checked={editOverride.enabled}
                    onChange={(e) => {
                      const enabled = e.target.checked
                      setEditOverride((o) => ({
                        ...o,
                        enabled,
                        ...(enabled ? {} : { breakStart: undefined, breakEnd: undefined }),
                      }))
                    }}
                    className="w-5 h-5 rounded border-white/30 bg-white/10 text-emerald-500 focus:ring-emerald-500/50"
                  />
                  <span className="text-sm text-gray-300">Робочий день</span>
                </label>

                {editOverride.enabled ? (
                  <>
                    <div className="flex items-center gap-3 mb-3 flex-wrap min-w-0">
                      <input
                        type="time"
                        value={editOverride.start}
                        onChange={(e) => setEditOverride((o) => ({ ...o, start: e.target.value }))}
                        className="time-slot-input flex-1 min-w-[5.5rem] min-h-[40px] px-3 py-2 text-sm font-medium tabular-nums rounded-lg bg-white/15 text-white border border-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      />
                      <span className="text-gray-500 text-sm shrink-0">–</span>
                      <input
                        type="time"
                        value={editOverride.end}
                        onChange={(e) => setEditOverride((o) => ({ ...o, end: e.target.value }))}
                        className="time-slot-input flex-1 min-w-[5.5rem] min-h-[40px] px-3 py-2 text-sm font-medium tabular-nums rounded-lg bg-white/15 text-white border border-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      />
                    </div>

                    <label className="flex items-center gap-2 mb-2 min-h-[44px] cursor-pointer touch-target">
                      <input
                        type="checkbox"
                        checked={hasBreak}
                        onChange={(e) => {
                          const enabled = e.target.checked
                          setEditOverride((o) => ({
                            ...o,
                            breakStart: enabled ? (o.breakStart ?? '13:00') : undefined,
                            breakEnd: enabled ? (o.breakEnd ?? '14:00') : undefined,
                          }))
                        }}
                        className="w-5 h-5 rounded border-white/30 bg-white/10 text-amber-500 focus:ring-amber-500/50"
                      />
                      <span className="text-sm text-gray-300">Перерва</span>
                    </label>

                    {hasBreak && (
                      <div className="flex items-center gap-3 mb-3 flex-wrap min-w-0">
                        <input
                          type="time"
                          value={editOverride.breakStart ?? '13:00'}
                          onChange={(e) => setEditOverride((o) => ({ ...o, breakStart: e.target.value }))}
                          className="time-slot-input flex-1 min-w-[5.5rem] min-h-[40px] px-3 py-2 text-sm font-medium tabular-nums rounded-lg bg-white/15 text-white border border-white/25 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40 [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        />
                        <span className="text-gray-500 text-sm shrink-0">–</span>
                        <input
                          type="time"
                          value={editOverride.breakEnd ?? '14:00'}
                          onChange={(e) => setEditOverride((o) => ({ ...o, breakEnd: e.target.value }))}
                          className="time-slot-input flex-1 min-w-[5.5rem] min-h-[40px] px-3 py-2 text-sm font-medium tabular-nums rounded-lg bg-white/15 text-white border border-white/25 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40 [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-[11px] text-gray-500 mb-3">Дата буде вихідною</div>
                )}

                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const validation = validateOverride(editOverride)
                      if (!validation.ok) {
                        toast({ title: 'Некоректні дані', description: validation.message, type: 'error' })
                        return
                      }
                      setOverrideForDate(editingDateKey, {
                        enabled: editOverride.enabled,
                        start: editOverride.start,
                        end: editOverride.end,
                        breakStart: editOverride.enabled ? editOverride.breakStart : undefined,
                        breakEnd: editOverride.enabled ? editOverride.breakEnd : undefined,
                      })
                    }}
                    className="flex-1 min-w-0 min-h-[44px] px-3 py-2.5 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white touch-target"
                  >
                    Зберегти дату
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideForDate(editingDateKey, null)}
                    className="min-h-[44px] px-3 py-2.5 text-sm rounded-xl border border-white/20 text-gray-400 hover:bg-white/10 touch-target"
                  >
                    Очистити
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingDateKey(null)}
                    className="min-h-[44px] px-3 py-2.5 text-sm rounded-xl border border-white/20 text-gray-400 hover:bg-white/10 touch-target"
                    aria-label="Закрити"
                  >
                    Закрити
                  </button>
                </div>
              </div>
            </>
          )}

          {showErrorToast && errorMessage && (
            <ErrorToast
              message={errorMessage}
              onClose={() => {
                setShowErrorToast(false)
                setErrorMessage('')
              }}
            />
          )}
        </div>
      </div>
    </ModalPortal>
  )
}

