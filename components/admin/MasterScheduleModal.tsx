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
      <div className="modal-overlay sm:!p-4" onClick={onClose} role="presentation">
        <div className="relative w-[95%] sm:w-full sm:max-w-xl sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onClose}
            className="modal-close touch-target text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30 rounded-xl"
            aria-label="Закрити"
          >
            <XIcon className="w-5 h-5" />
          </button>

          <div className="pr-10 mb-2 flex-shrink-0">
            <h2 className="modal-title">Графік роботи</h2>
            <p className="modal-subtitle truncate">{master.name}</p>
          </div>

          <div className="flex gap-2 mb-2 border-b border-white/20 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('week')}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'week' ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'
              )}
            >
              Тиждень
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('month')}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'month' ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'
              )}
            >
              Місяць
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2.5 flex-1 min-h-0 overflow-y-auto">
            {activeTab === 'week' && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Робочі години (типовий тиждень)</h3>
                {/* Пресети та швидкі дії */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {WEEK_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="px-2.5 py-1.5 text-[10px] font-medium rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={applySameHoursToAllWorkingDays}
                    className="px-2.5 py-1.5 text-[10px] font-medium rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    Однакові години для всіх робочих днів
                  </button>
                </div>
                {/* Табличний вигляд: День | Початок | Кінець */}
                <div className="rounded-xl border border-white/10 overflow-hidden">
                  <div className="grid grid-cols-[1fr_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-0.5 px-3 py-2 bg-white/5 border-b border-white/10 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
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
                          'grid grid-cols-[1fr_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-0 items-center px-3 py-2.5 border-b border-white/5 last:border-0 transition-colors',
                          dayHours.enabled ? 'bg-white/5' : 'bg-white/[0.02] opacity-75'
                        )}
                      >
                        <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={dayHours.enabled}
                            onChange={() => handleDayToggle(day.key)}
                            className="w-4 h-4 shrink-0 rounded border-white/30 bg-white/10 text-green-500 focus:ring-green-500/50"
                          />
                          <span className="text-sm font-medium text-white truncate">{day.label}</span>
                        </label>
                        {dayHours.enabled ? (
                          <>
                            <input
                              type="time"
                              value={dayHours.start}
                              onChange={(e) => handleTimeChange(day.key, 'start', e.target.value)}
                              className="w-full min-w-0 px-2 py-1.5 text-xs rounded-lg border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-1 focus:ring-white/30 [&::-webkit-calendar-picker-indicator]:opacity-60"
                            />
                            <input
                              type="time"
                              value={dayHours.end}
                              onChange={(e) => handleTimeChange(day.key, 'end', e.target.value)}
                              className="w-full min-w-0 px-2 py-1.5 text-xs rounded-lg border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-1 focus:ring-white/30 [&::-webkit-calendar-picker-indicator]:opacity-60"
                            />
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-gray-500 col-span-2">Вихідний</span>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
                {/* Рядок перерви для кожного робочого дня */}
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-medium text-gray-400">Перерви (опційно)</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {DAYS.filter((d) => workingHours[d.key]?.enabled).map((day) => {
                      const dayHours = workingHours[day.key] || { enabled: true, start: '09:00', end: '18:00' }
                      const hasBreak = dayHours.breakStart != null && dayHours.breakEnd != null
                      return (
                        <div key={day.key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`break-${day.key}`}
                            checked={hasBreak}
                            onChange={(e) => setBreakEnabled(day.key, e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-white/30 bg-white/10 text-amber-500 focus:ring-amber-500/50"
                          />
                          <label htmlFor={`break-${day.key}`} className="text-xs text-gray-300">{day.short}</label>
                          {hasBreak && (
                            <>
                              <input
                                type="time"
                                value={dayHours.breakStart}
                                onChange={(e) => handleBreakChange(day.key, 'breakStart', e.target.value)}
                                className="w-20 px-1.5 py-1 text-[11px] rounded border border-white/20 bg-white/10 text-white [&::-webkit-calendar-picker-indicator]:opacity-60"
                              />
                              <span className="text-gray-500">–</span>
                              <input
                                type="time"
                                value={dayHours.breakEnd}
                                onChange={(e) => handleBreakChange(day.key, 'breakEnd', e.target.value)}
                                className="w-20 px-1.5 py-1 text-[11px] rounded border border-white/20 bg-white/10 text-white [&::-webkit-calendar-picker-indicator]:opacity-60"
                              />
                            </>
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
                    className="p-1.5 rounded border border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs"
                  >
                    ←
                  </button>
                  <span className="text-xs font-semibold text-white capitalize">
                    {format(monthDate, 'LLLL yyyy', { locale: uk })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMonthDate(addMonths(monthDate, 1))}
                    className="p-1.5 rounded border border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs"
                  >
                    →
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">Клік по дню — змінити години або вихідний. Без виключення = графік тижня.</p>
                <div className="grid grid-cols-7 gap-0.5 mb-1">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((d) => (
                    <div key={d} className="text-center text-[9px] font-medium text-gray-500 py-0.5">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5 mb-3">
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
                            'w-full min-h-[28px] py-0.5 rounded text-[9px] font-medium transition-colors flex flex-col items-center justify-center leading-tight',
                            !inMonth && 'opacity-25 cursor-default',
                            inMonth && isWorking && !override && 'bg-white/10 border border-white/15 text-white',
                            inMonth && isWorking && override && 'bg-green-500/25 border border-green-500/30 text-green-200',
                            inMonth && !isWorking && 'bg-red-500/15 border border-red-500/20 text-red-300',
                            inMonth && 'cursor-pointer hover:ring-1 hover:ring-white/50'
                          )}
                        >
                          <span>{format(day, 'd')}</span>
                          {inMonth && <span className="text-[8px] opacity-80 truncate max-w-full">{label}</span>}
                        </button>
                        {isEditing && inMonth && (
                          <div className="absolute left-0 top-full z-20 mt-1 p-2.5 rounded-lg bg-[#2A2A2A] border border-white/20 shadow-xl min-w-[180px]">
                            <div className="text-[10px] font-medium text-white mb-1.5">{format(day, 'd MMM yyyy', { locale: uk })}</div>
                            <label className="flex items-center gap-1.5 mb-1.5">
                              <input
                                type="checkbox"
                                checked={editOverride.enabled}
                                onChange={(e) => setEditOverride((o) => ({ ...o, enabled: e.target.checked }))}
                                className="w-3.5 h-3.5 rounded"
                              />
                              <span className="text-[10px] text-gray-300">Робочий</span>
                            </label>
                            {editOverride.enabled && (
                              <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                                <input
                                  type="time"
                                  value={editOverride.start}
                                  onChange={(e) => setEditOverride((o) => ({ ...o, start: e.target.value }))}
                                  className="min-w-[8.5rem] sm:min-w-[5rem] flex-1 px-1.5 py-1 pr-2 sm:pr-6 text-[10px] rounded bg-white/10 text-white border border-white/20 [&::-webkit-calendar-picker-indicator]:opacity-60"
                                />
                                <span className="text-gray-500 text-[10px]">–</span>
                                <input
                                  type="time"
                                  value={editOverride.end}
                                  onChange={(e) => setEditOverride((o) => ({ ...o, end: e.target.value }))}
                                  className="min-w-[8.5rem] sm:min-w-[5rem] flex-1 px-1.5 py-1 pr-2 sm:pr-6 text-[10px] rounded bg-white/10 text-white border border-white/20 [&::-webkit-calendar-picker-indicator]:opacity-60"
                                />
                              </div>
                            )}
                            <div className="flex gap-1 mt-1">
                              <button
                                type="button"
                                onClick={() => setOverrideForDate(dateKey, editOverride)}
                                className="flex-1 px-2 py-1 text-[10px] font-medium rounded bg-white text-black"
                              >
                                Зберегти
                              </button>
                              <button
                                type="button"
                                onClick={() => setOverrideForDate(dateKey, null)}
                                className="px-2 py-1 text-[10px] rounded border border-white/20 text-gray-400 hover:bg-white/10"
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
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={copyWeekToMonth}
                    className="px-2.5 py-1.5 text-[10px] font-medium rounded border border-white/20 bg-white/10 text-white hover:bg-white/20"
                  >
                    Копіювати тиждень на місяць
                  </button>
                  <button
                    type="button"
                    onClick={clearMonthOverrides}
                    className="px-2.5 py-1.5 text-[10px] font-medium rounded border border-white/20 bg-white/10 text-white hover:bg-white/20"
                  >
                    Очистити виключення
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-3 py-2 text-sm font-medium rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                Скасувати
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg bg-white text-black hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-dashboard-button"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
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
