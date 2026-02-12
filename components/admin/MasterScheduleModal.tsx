'use client'

import { useState, useEffect } from 'react'
import { XIcon, CalendarIcon, ClockIcon, CheckIcon } from '@/components/icons'
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
  isSameDay,
  parse,
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
  onClose: () => void
  onSave: (workingHours?: string, scheduleDateOverrides?: string) => void
}

interface DayHours {
  enabled: boolean
  start: string
  end: string
  breakStart?: string
  breakEnd?: string
}

interface WorkingHours {
  [key: string]: DayHours
}

type DateOverride = { enabled: boolean; start: string; end: string }
type DateOverridesMap = Record<string, DateOverride>

const DAYS = [
  { key: 'monday', label: 'Понеділок', short: 'Пн' },
  { key: 'tuesday', label: 'Вівторок', short: 'Вт' },
  { key: 'wednesday', label: 'Середа', short: 'Ср' },
  { key: 'thursday', label: 'Четвер', short: 'Чт' },
  { key: 'friday', label: "П'ятниця", short: 'Пт' },
  { key: 'saturday', label: 'Субота', short: 'Сб' },
  { key: 'sunday', label: 'Неділя', short: 'Нд' },
]

const defaultDayHours = (): DayHours => ({ enabled: true, start: '09:00', end: '18:00' })

const WEEK_PRESETS: { label: string; hours: WorkingHours }[] = [
  {
    label: 'Пн–Пт 9:00–18:00',
    hours: {
      monday: { ...defaultDayHours(), enabled: true },
      tuesday: { ...defaultDayHours(), enabled: true },
      wednesday: { ...defaultDayHours(), enabled: true },
      thursday: { ...defaultDayHours(), enabled: true },
      friday: { ...defaultDayHours(), enabled: true },
      saturday: { ...defaultDayHours(), enabled: false },
      sunday: { ...defaultDayHours(), enabled: false },
    },
  },
  {
    label: 'Пн–Сб 10:00–19:00',
    hours: {
      monday: { enabled: true, start: '10:00', end: '19:00' },
      tuesday: { enabled: true, start: '10:00', end: '19:00' },
      wednesday: { enabled: true, start: '10:00', end: '19:00' },
      thursday: { enabled: true, start: '10:00', end: '19:00' },
      friday: { enabled: true, start: '10:00', end: '19:00' },
      saturday: { enabled: true, start: '10:00', end: '19:00' },
      sunday: { enabled: false, start: '10:00', end: '19:00' },
    },
  },
]

export function MasterScheduleModal({
  master,
  businessId,
  otherMasters = [],
  onClose,
  onSave,
}: MasterScheduleModalProps) {
  const [activeTab, setActiveTab] = useState<'week' | 'month'>('week')
  const [workingHours, setWorkingHours] = useState<WorkingHours>({})
  const [scheduleDateOverrides, setScheduleDateOverrides] = useState<DateOverridesMap>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showErrorToast, setShowErrorToast] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [monthDate, setMonthDate] = useState(() => new Date())
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [editOverride, setEditOverride] = useState<DateOverride>({ enabled: true, start: '09:00', end: '18:00' })

  useEffect(() => {
    try {
      if (master.workingHours) {
        const parsed = typeof master.workingHours === 'string'
          ? JSON.parse(master.workingHours)
          : master.workingHours
        setWorkingHours(parsed || {})
      } else {
        const defaultHours: WorkingHours = {}
        DAYS.forEach((day, index) => {
          defaultHours[day.key] = {
            enabled: index < 5,
            start: '09:00',
            end: '18:00',
          }
        })
        setWorkingHours(defaultHours)
      }

      if (master.scheduleDateOverrides) {
        const parsed = typeof master.scheduleDateOverrides === 'string'
          ? JSON.parse(master.scheduleDateOverrides)
          : master.scheduleDateOverrides
        setScheduleDateOverrides(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {})
      } else {
        setScheduleDateOverrides({})
      }
    } catch (e) {
      console.error('Error parsing schedule:', e)
    }
  }, [master])

  const handleDayToggle = (dayKey: string) => {
    setWorkingHours((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        enabled: !prev[dayKey]?.enabled,
      },
    }))
  }

  const handleTimeChange = (dayKey: string, field: 'start' | 'end', value: string) => {
    setWorkingHours((prev) => ({
      ...prev,
      [dayKey]: {
        ...(prev[dayKey] || { enabled: true, start: '09:00', end: '18:00' }),
        [field]: value,
      },
    }))
  }

  const handleBreakChange = (dayKey: string, field: 'breakStart' | 'breakEnd', value: string) => {
    setWorkingHours((prev) => ({
      ...prev,
      [dayKey]: {
        ...(prev[dayKey] || { enabled: true, start: '09:00', end: '18:00' }),
        [field]: value,
      },
    }))
  }

  const setBreakEnabled = (dayKey: string, enabled: boolean) => {
    setWorkingHours((prev) => ({
      ...prev,
      [dayKey]: {
        ...(prev[dayKey] || { enabled: true, start: '09:00', end: '18:00' }),
        breakStart: enabled ? '13:00' : undefined,
        breakEnd: enabled ? '14:00' : undefined,
      },
    }))
  }

  const getWeekdayKey = (date: Date): string => {
    const d = date.getDay()
    const keys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    return keys[d]
  }

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
    setEditingDate(null)
  }

  const applyPreset = (preset: { hours: WorkingHours }) => {
    setWorkingHours(preset.hours)
    toast({ title: 'Застосовано', description: 'Пресет застосовано до тижня', type: 'success', duration: 2000 })
  }

  const applySameHoursToAllWorkingDays = () => {
    const firstEnabled = DAYS.find((d) => workingHours[d.key]?.enabled)
    if (!firstEnabled) {
      toast({ title: 'Немає робочих днів', description: 'Увімкніть хоча б один день', type: 'error' })
      return
    }
    const template = workingHours[firstEnabled.key]
    if (!template) return
    const next: WorkingHours = { ...workingHours }
    DAYS.forEach((d) => {
      if (next[d.key]?.enabled) {
        next[d.key] = {
          ...next[d.key],
          start: template.start,
          end: template.end,
          breakStart: template.breakStart,
          breakEnd: template.breakEnd,
        }
      }
    })
    setWorkingHours(next)
    toast({ title: 'Готово', description: 'Однакові години застосовано до всіх робочих днів', type: 'success', duration: 2000 })
  }

  const copyWeekToMonth = () => {
    const start = startOfMonth(monthDate)
    const end = endOfMonth(monthDate)
    const days = eachDayOfInterval({ start, end })
    const next = { ...scheduleDateOverrides }
    days.forEach((d) => {
      const key = format(d, 'yyyy-MM-dd')
      const dayKey = getWeekdayKey(d)
      const wh = workingHours[dayKey]
      if (wh) {
        next[key] = { enabled: wh.enabled, start: wh.start, end: wh.end }
      }
    })
    setScheduleDateOverrides(next)
    toast({ title: 'Готово', description: 'Графік тижня застосовано до вибраного місяця', type: 'success' })
  }

  const clearMonthOverrides = () => {
    const start = startOfMonth(monthDate)
    const end = endOfMonth(monthDate)
    const days = eachDayOfInterval({ start, end })
    const keysToRemove = days.map((d) => format(d, 'yyyy-MM-dd'))
    setScheduleDateOverrides((prev) => {
      const next = { ...prev }
      keysToRemove.forEach((k) => delete next[k])
      return next
    })
    setEditingDate(null)
    toast({ title: 'Готово', description: 'Виключення місяця очищено', type: 'success' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setShowErrorToast(false)
    try {
      const workingHoursJson = JSON.stringify(workingHours)
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
        const error = await response.json()
        throw new Error(error.error || 'Не вдалося зберегти графік')
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  return (
    <ModalPortal>
      <div className="modal-overlay sm:!p-4 p-3" onClick={onClose} role="presentation">
        <div className="relative w-full max-w-[min(100%,28rem)] sm:max-w-xl sm:my-auto modal-content modal-dialog text-white h-[85dvh] max-h-[85dvh] sm:h-auto sm:max-h-[85dvh] flex flex-col min-h-0 rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
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

          <div className="flex gap-2 px-4 sm:px-6 mb-3 border-b border-white/20 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('week')}
              className={cn(
                'flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors touch-target',
                activeTab === 'week' ? 'bg-white text-black shadow-lg' : 'bg-white/10 text-white hover:bg-white/20 active:bg-white/15'
              )}
            >
              Тиждень
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('month')}
              className={cn(
                'flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors touch-target',
                activeTab === 'month' ? 'bg-white text-black shadow-lg' : 'bg-white/10 text-white hover:bg-white/20 active:bg-white/15'
              )}
            >
              Місяць
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 sm:px-6 pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
            {activeTab === 'week' && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Робочі години (типовий тиждень)</h3>
                {/* Пресети та швидкі дії */}
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                  <div className="flex flex-wrap gap-2">
                    {WEEK_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="min-h-[40px] px-3 py-2 text-xs font-medium rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 active:bg-white/15 transition-colors touch-target"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={applySameHoursToAllWorkingDays}
                    className="min-h-[40px] w-full sm:w-auto px-3 py-2 text-xs font-medium rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 active:bg-emerald-500/15 transition-colors touch-target text-left sm:text-center"
                  >
                    Однакові години для всіх робочих днів
                  </button>
                </div>
                {/* Табличний вигляд: День | Початок | Кінець — адаптивно на мобільному */}
                <div className="rounded-xl border border-white/10 overflow-hidden min-w-0">
                  <div className="hidden sm:grid grid-cols-[1fr_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 px-3 py-2.5 bg-white/5 border-b border-white/10 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    <div>День</div>
                    <div>Початок</div>
                    <div>Кінець</div>
                  </div>
                  {DAYS.map((day) => {
                    const dayHours = workingHours[day.key] || { enabled: false, start: '09:00', end: '18:00' }
                    return (
                      <div
                        key={day.key}
                        className={cn(
                          'grid grid-cols-1 sm:grid-cols-[1fr_minmax(0,1fr)_minmax(0,1fr)] gap-3 sm:gap-x-3 sm:gap-y-0 items-start sm:items-center px-3 py-3 sm:py-2.5 border-b border-white/5 last:border-0 transition-colors min-w-0 overflow-hidden',
                          dayHours.enabled ? 'bg-white/5' : 'bg-white/[0.02] opacity-75'
                        )}
                      >
                        <label className="flex items-center gap-3 min-w-0 cursor-pointer min-h-[44px] touch-target">
                          <input
                            type="checkbox"
                            checked={dayHours.enabled}
                            onChange={() => handleDayToggle(day.key)}
                            className="w-5 h-5 shrink-0 rounded border-white/30 bg-white/10 text-green-500 focus:ring-green-500/50"
                          />
                          <span className="text-sm font-medium text-white truncate">{day.label}</span>
                        </label>
                        {dayHours.enabled ? (
                          /* На малих екранах: один ряд — дві колонки Початок | Кінець; на sm+ — таблиця. gap і min-width щоб не наїжджали. */
                            <div className="pl-8 sm:pl-0 grid grid-cols-2 sm:contents gap-3 sm:gap-x-3 min-w-0 w-full overflow-hidden">
                              <div className="flex flex-col gap-1 min-w-0 w-full overflow-hidden sm:flex-row sm:items-center sm:gap-2 sm:w-auto">
                                <span className="text-[10px] font-medium text-gray-500 shrink-0 sm:w-14">Початок</span>
                                <input
                                  type="time"
                                  value={dayHours.start}
                                  onChange={(e) => handleTimeChange(day.key, 'start', e.target.value)}
                                  className="time-slot-input w-full min-w-[5.5rem] max-w-full min-h-[40px] sm:min-h-[36px] sm:min-w-0 px-2 sm:px-3 py-2 text-sm font-medium tabular-nums rounded-lg border border-white/25 bg-white/15 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                />
                              </div>
                              <div className="flex flex-col gap-1 min-w-0 w-full overflow-hidden sm:flex-row sm:items-center sm:gap-2 sm:w-auto">
                                <span className="text-[10px] font-medium text-gray-500 shrink-0 sm:w-14">Кінець</span>
                                <input
                                  type="time"
                                  value={dayHours.end}
                                  onChange={(e) => handleTimeChange(day.key, 'end', e.target.value)}
                                  className="time-slot-input w-full min-w-[5.5rem] max-w-full min-h-[40px] sm:min-h-[36px] sm:min-w-0 px-2 sm:px-3 py-2 text-sm font-medium tabular-nums rounded-lg border border-white/25 bg-white/15 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                />
                              </div>
                            </div>
                        ) : (
                          <span className="text-xs text-gray-500 pl-8 sm:pl-0 sm:col-span-2">Вихідний</span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {/* Рядок перерви для кожного робочого дня */}
                <div className="mt-4 space-y-3 w-full min-w-0 overflow-hidden">
                  <p className="text-[11px] font-medium text-gray-400">Перерви (опційно)</p>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 w-full min-w-0">
                    {DAYS.filter((d) => workingHours[d.key]?.enabled).map((day) => {
                      const dayHours = workingHours[day.key] || { enabled: true, start: '09:00', end: '18:00' }
                      const hasBreak = dayHours.breakStart != null && dayHours.breakEnd != null
                      return (
                        <div key={day.key} className="flex items-center gap-2 sm:gap-3 min-h-[40px] w-full max-w-full min-w-0 p-2 rounded-lg bg-white/5 border border-white/10 overflow-hidden">
                          <input
                            type="checkbox"
                            id={`break-${day.key}`}
                            checked={hasBreak}
                            onChange={(e) => setBreakEnabled(day.key, e.target.checked)}
                            className="w-4 h-4 shrink-0 rounded border-white/30 bg-white/10 text-amber-500 focus:ring-amber-500/50"
                          />
                          <label htmlFor={`break-${day.key}`} className="text-xs text-gray-300 cursor-pointer touch-target py-1 shrink-0 w-6">{day.short}</label>
                          {hasBreak && (
                            <div className="grid grid-cols-[1fr_auto_1fr] gap-1.5 sm:gap-2 flex-1 min-w-0 items-center max-w-full">
                              <input
                                type="time"
                                value={dayHours.breakStart}
                                onChange={(e) => handleBreakChange(day.key, 'breakStart', e.target.value)}
                                className="time-slot-input min-h-[36px] w-full min-w-0 max-w-full px-2 py-1.5 text-xs font-medium tabular-nums rounded-lg border border-white/25 bg-white/15 text-white focus:ring-2 focus:ring-emerald-500/50 [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                              />
                              <span className="text-gray-500 text-xs shrink-0 px-0.5">–</span>
                              <input
                                type="time"
                                value={dayHours.breakEnd}
                                onChange={(e) => handleBreakChange(day.key, 'breakEnd', e.target.value)}
                                className="time-slot-input min-h-[36px] w-full min-w-0 max-w-full px-2 py-1.5 text-xs font-medium tabular-nums rounded-lg border border-white/25 bg-white/15 text-white focus:ring-2 focus:ring-emerald-500/50 [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {DAYS.filter((d) => workingHours[d.key]?.enabled).length === 0 && (
                      <span className="text-xs text-gray-500">Увімкніть робочі дні вище</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'month' && (
              <div className="space-y-3">
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
                <p className="text-[11px] text-gray-400 leading-relaxed">Клік по дню — змінити години або вихідний. Без виключення = графік тижня.</p>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((d) => (
                    <div key={d} className="text-center text-[10px] font-semibold text-gray-500 py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {calendarDays.map((day) => {
                    const inMonth = isSameMonth(day, monthDate)
                    const dateKey = format(day, 'yyyy-MM-dd')
                    const override = getOverrideForDate(dateKey)
                    const dayKey = getWeekdayKey(day)
                    const weekHours = workingHours[dayKey]
                    const isWorking = override ? override.enabled : weekHours?.enabled ?? false
                    const isEditing = editingDate === dateKey
                    const label = override ? (override.enabled ? `${override.start.slice(0, 5)}–${override.end.slice(0, 5)}` : 'в') : (isWorking ? '✓' : '—')
                    return (
                      <div key={dateKey} className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            if (!inMonth) return
                            setEditingDate(dateKey)
                            setEditOverride(
                              override ?? {
                                enabled: weekHours?.enabled ?? true,
                                start: weekHours?.start ?? '09:00',
                                end: weekHours?.end ?? '18:00',
                              }
                            )
                          }}
                          disabled={!inMonth}
                          title={inMonth ? `${format(day, 'd MMM', { locale: uk })}: ${override ? (override.enabled ? `${override.start}–${override.end}` : 'вихідний') : (isWorking ? 'за тижнем' : 'вихідний')}` : ''}
                          className={cn(
                            'w-full min-h-[36px] sm:min-h-[32px] py-1.5 sm:py-0.5 rounded-lg text-[11px] sm:text-[10px] font-medium transition-colors flex flex-col items-center justify-center leading-tight touch-target',
                            !inMonth && 'opacity-25 cursor-default',
                            inMonth && isWorking && !override && 'bg-white/10 border border-white/15 text-white',
                            inMonth && isWorking && override && 'bg-green-500/25 border border-green-500/30 text-green-200',
                            inMonth && !isWorking && 'bg-red-500/15 border border-red-500/20 text-red-300',
                            inMonth && 'cursor-pointer hover:ring-2 hover:ring-white/50 active:scale-95'
                          )}
                        >
                          <span>{format(day, 'd')}</span>
                          {inMonth && <span className="text-[8px] sm:text-[7px] opacity-80 truncate max-w-full">{label}</span>}
                        </button>
                        {isEditing && inMonth && (
                          <div className="absolute left-1/2 -translate-x-1/2 top-full z-20 mt-2 p-4 rounded-xl bg-[#1f1f1f] border border-white/20 shadow-2xl min-w-[240px] max-w-[min(100vw-2rem,320px)] sm:left-0 sm:translate-x-0">
                            <div className="text-sm font-medium text-white mb-3">{format(day, 'd MMM yyyy', { locale: uk })}</div>
                            <label className="flex items-center gap-2 mb-3 min-h-[44px] cursor-pointer touch-target">
                              <input
                                type="checkbox"
                                checked={editOverride.enabled}
                                onChange={(e) => setEditOverride((o) => ({ ...o, enabled: e.target.checked }))}
                                className="w-5 h-5 rounded border-white/30 bg-white/10 text-green-500 focus:ring-green-500/50"
                              />
                              <span className="text-sm text-gray-300">Робочий</span>
                            </label>
                            {editOverride.enabled && (
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
                            )}
                            <div className="flex gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => setOverrideForDate(dateKey, editOverride)}
                                className="flex-1 min-h-[44px] px-3 py-2.5 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white touch-target"
                              >
                                Зберегти
                              </button>
                              <button
                                type="button"
                                onClick={() => setOverrideForDate(dateKey, null)}
                                className="min-h-[44px] px-3 py-2.5 text-sm rounded-xl border border-white/20 text-gray-400 hover:bg-white/10 touch-target"
                              >
                                Як у тижні
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {(() => {
                  const start = startOfMonth(monthDate)
                  const end = endOfMonth(monthDate)
                  const daysInMonth = eachDayOfInterval({ start, end })
                  const overridesInMonth = daysInMonth
                    .map((d) => ({ dateKey: format(d, 'yyyy-MM-dd'), override: getOverrideForDate(format(d, 'yyyy-MM-dd')) }))
                    .filter((x) => x.override != null)
                  if (overridesInMonth.length === 0) return null
                  return (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                      <div className="text-[9px] font-semibold text-gray-400 mb-1">Виключення цього місяця:</div>
                      <div className="max-h-20 overflow-y-auto space-y-0.5">
                        {overridesInMonth.map(({ dateKey, override }) => (
                          <div key={dateKey} className="flex items-center justify-between text-[10px]">
                            <span className="text-white">{format(parse(dateKey, 'yyyy-MM-dd', new Date()), 'd MMM', { locale: uk })}</span>
                            <span className={override!.enabled ? 'text-green-300' : 'text-red-300'}>
                              {override!.enabled ? `${override!.start}–${override!.end}` : 'вихідний'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={copyWeekToMonth}
                    className="min-h-[44px] flex-1 px-3 py-2.5 text-sm font-medium rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 active:bg-white/15 touch-target"
                  >
                    Копіювати тиждень на місяць
                  </button>
                  <button
                    type="button"
                    onClick={clearMonthOverrides}
                    className="min-h-[44px] flex-1 px-3 py-2.5 text-sm font-medium rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 active:bg-white/15 touch-target"
                  >
                    Очистити виключення
                  </button>
                </div>
              </div>
            )}
            </div>

            <div className="flex gap-3 px-4 sm:px-6 py-4 border-t border-white/10 bg-black/20 flex-shrink-0">
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
