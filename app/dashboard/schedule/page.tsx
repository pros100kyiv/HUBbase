'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ClockIcon, UserIcon, SettingsIcon, TrashIcon, ChevronDownIcon } from '@/components/icons'
import { MasterScheduleModal } from '@/components/admin/MasterScheduleModal'
import { QuickMasterCard } from '@/components/admin/QuickMasterCard'
import { toast } from '@/components/ui/toast'

interface Master {
  id: string
  name: string
  photo?: string | null
  bio?: string | null
  rating?: number
  isActive?: boolean
  workingHours?: string | null
  scheduleDateOverrides?: string | null
}

interface DaySchedule {
  enabled: boolean
  start: string
  end: string
}

interface WorkingHours {
  [key: string]: DaySchedule
}

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_LABELS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

function parseWorkingHours(workingHours?: string | null): WorkingHours | null {
  if (!workingHours) return null
  try {
    return JSON.parse(workingHours) as WorkingHours
  } catch {
    return null
  }
}

/** День тижня для JS getDay(): 0=Нд, 1=Пн, ..., 6=Сб → ключ DAY_KEYS */
function getTodayDayKey(): string {
  const d = new Date().getDay() // 0 Sun .. 6 Sat
  return DAY_KEYS[(d + 6) % 7] // 0 -> sunday (index 6), 1 -> monday (0), ...
}

/** Дата сьогодні в форматі YYYY-MM-DD */
function getTodayDateKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Перевіряє, чи є виключення за датою (scheduleDateOverrides) */
function parseDateOverrides(overrides?: string | null): Record<string, { enabled: boolean; start: string; end: string }> | null {
  if (!overrides) return null
  try {
    const o = JSON.parse(overrides)
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null
  } catch {
    return null
  }
}

/** Повертає графік майстра на сьогодні: спочатку виключення за датою, потім тижневий графік */
function getMasterScheduleToday(master: Master): { enabled: boolean; start: string; end: string } | null {
  const todayKey = getTodayDateKey()
  const dayKey = getTodayDayKey()
  const dateOverrides = parseDateOverrides(master.scheduleDateOverrides)
  const override = dateOverrides?.[todayKey]
  if (override !== undefined) {
    return { enabled: override.enabled, start: override.start ?? '09:00', end: override.end ?? '18:00' }
  }
  const hours = parseWorkingHours(master.workingHours)
  const day = hours?.[dayKey]
  return day ? { enabled: day.enabled, start: day.start ?? '09:00', end: day.end ?? '18:00' } : null
}

/** Короткий опис графіка для картки: "Пн–Пт 09:00–18:00" або "За графіком" */
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
  const sameHours = enabled.every(
    (k) => hours[k]?.start === start && hours[k]?.end === end
  )
  if (sameHours) return `${firstDay}–${lastDay} ${start}–${end}`
  return 'За графіком'
}

export default function SchedulePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [business, setBusiness] = useState<{ id: string } | null>(null)
  const [masters, setMasters] = useState<Master[]>([])
  const [loading, setLoading] = useState(true)
  const [scheduleModalMaster, setScheduleModalMaster] = useState<Master | null>(null)
  const [showQuickMasterCard, setShowQuickMasterCard] = useState(false)
  const [editingMaster, setEditingMaster] = useState<Master | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [showWeekOverview, setShowWeekOverview] = useState(false)

  const loadMasters = useCallback(() => {
    if (!business?.id) return
    fetch(`/api/masters?businessId=${business.id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to fetch'))))
      .then((data: Master[]) => setMasters(Array.isArray(data) ? data : []))
      .catch(() => setMasters([]))
      .finally(() => setLoading(false))
  }, [business?.id])

  useEffect(() => {
    const raw = localStorage.getItem('business')
    if (!raw) {
      router.push('/login')
      return
    }
    try {
      setBusiness(JSON.parse(raw))
    } catch {
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    if (business) loadMasters()
  }, [business, loadMasters])

  const editId = searchParams.get('edit')
  useEffect(() => {
    if (!editId || masters.length === 0) return
    const master = masters.find((m) => m.id === editId)
    if (master) {
      setEditingMaster(master)
      setShowQuickMasterCard(true)
      router.replace('/dashboard/schedule', { scroll: false })
    }
  }, [editId, masters, router])

  const getMasterScheduleForDay = (master: Master, dayKey: string): DaySchedule | null => {
    const hours = parseWorkingHours(master.workingHours)
    const day = hours?.[dayKey]
    return day ?? null
  }

  const handleScheduleSave = () => {
    loadMasters()
    setScheduleModalMaster(null)
  }

  const handleDeleteMaster = async (master: Master) => {
    if (!business?.id) return
    setOpenMenuId(null)
    if (!window.confirm(`Видалити спеціаліста ${master.name}? Цю дію не можна скасувати.`)) return
    try {
      const res = await fetch(`/api/masters/${master.id}?businessId=${business.id}`, { method: 'DELETE' })
      if (res.ok) {
        loadMasters()
        toast({ title: 'Спеціаліста видалено', type: 'success' })
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: 'Помилка', description: (data as { error?: string }).error || 'Не вдалося видалити', type: 'error' })
      }
    } catch {
      toast({ title: 'Помилка', description: 'Помилка при видаленні', type: 'error' })
    }
  }

  const handleQuickMasterSuccess = () => {
    loadMasters()
    setShowQuickMasterCard(false)
    setEditingMaster(null)
  }

  if (!business || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2" style={{ letterSpacing: '-0.02em' }}>
            <ClockIcon className="w-6 h-6 text-sky-400" />
            Графік роботи
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Додайте спеціалістів і налаштуйте їхній графік: робочі дні, години та виключення (відпустки, вихідні).
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingMaster(null); setShowQuickMasterCard(true) }}
          className="flex-shrink-0 px-4 py-2.5 bg-white text-black rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors flex items-center gap-2 shadow-lg shadow-black/20"
        >
          <UserIcon className="w-5 h-5" />
          Додати спеціаліста
        </button>
      </div>

      {/* Сьогодні працює: спеціаліст та час роботи */}
      {masters.length > 0 && (() => {
        const todayWorkers = masters
          .map((m) => ({ master: m, schedule: getMasterScheduleToday(m) }))
          .filter((x): x is { master: Master; schedule: { enabled: boolean; start: string; end: string } } => x.schedule?.enabled === true)
        const todayLabel = (() => {
          const d = new Date()
          const days = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота']
          return days[d.getDay()]
        })()
        return (
          <section className="mb-6 rounded-2xl p-4 md:p-5 card-glass border border-white/10 bg-white/5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
              Сьогодні працює
              <span className="text-gray-500 font-normal normal-case tracking-normal">({todayLabel})</span>
            </h2>
            {todayWorkers.length === 0 ? (
              <p className="text-sm text-gray-400">Сьогодні за графіком ніхто не працює.</p>
            ) : (
              <ul className="space-y-2.5">
                {todayWorkers.map(({ master, schedule }) => (
                  <li
                    key={master.id}
                    className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/15 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setScheduleModalMaster(master)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      {master.photo ? (
                        <img
                          src={master.photo}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/10"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center text-white font-semibold flex-shrink-0 border border-white/10">
                          {master.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-white truncate">{master.name}</span>
                    </button>
                    <span className="text-sm font-medium text-emerald-400 whitespace-nowrap flex-shrink-0">
                      {schedule.start.slice(0, 5)} – {schedule.end.slice(0, 5)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })()}

      {/* Список спеціалістів */}
      <section className="rounded-2xl p-4 md:p-6 card-glass border border-white/10">
        <h2 className="text-base font-semibold text-white mb-4">Спеціалісти</h2>

        {masters.length === 0 ? (
          <div className="py-12 px-4 text-center rounded-xl bg-white/5 border border-white/10 border-dashed">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
              <UserIcon className="w-7 h-7 text-gray-500" />
            </div>
            <p className="text-white font-medium mb-1">Немає спеціалістів</p>
            <p className="text-sm text-gray-400 mb-6">Додайте спеціаліста, щоб налаштувати графік роботи та записувати клієнтів.</p>
            <button
              type="button"
              onClick={() => { setEditingMaster(null); setShowQuickMasterCard(true) }}
              className="px-5 py-2.5 bg-white text-black rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              Додати спеціаліста
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {masters.map((master) => (
              <li
                key={master.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/15 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {master.photo ? (
                    <img
                      src={master.photo}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-white/10"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-white text-lg font-bold flex-shrink-0 border border-white/10">
                      {master.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white truncate">{master.name}</p>
                    <p className="text-sm text-gray-400">{getScheduleSummary(master.workingHours)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setScheduleModalMaster(master)}
                    className="px-4 py-2 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-400 text-sm font-medium hover:bg-sky-500/30 transition-colors flex items-center gap-2"
                  >
                    <ClockIcon className="w-4 h-4" />
                    Графік
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMenuId(openMenuId === master.id ? null : master.id)}
                      className="p-2 rounded-lg border border-white/20 bg-white/10 text-gray-400 hover:text-white hover:bg-white/15 transition-colors"
                      aria-label="Ще дії"
                    >
                      <ChevronDownIcon className={cn('w-4 h-4 transition-transform', openMenuId === master.id && 'rotate-180')} />
                    </button>
                    {openMenuId === master.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} aria-hidden />
                        <div className="absolute right-0 top-full mt-1 py-1 min-w-[140px] rounded-lg bg-[#1a1a1a] border border-white/20 shadow-xl z-20">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null)
                              setEditingMaster(master)
                              setShowQuickMasterCard(true)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                          >
                            <SettingsIcon className="w-4 h-4" />
                            Профіль
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMaster(master)}
                            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                          >
                            <TrashIcon className="w-4 h-4" />
                            Видалити
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {masters.length > 0 && (
          <button
            type="button"
            onClick={() => { setEditingMaster(null); setShowQuickMasterCard(true) }}
            className="w-full mt-4 py-2.5 rounded-xl border border-dashed border-white/20 text-gray-400 text-sm font-medium hover:bg-white/5 hover:text-white transition-colors flex items-center justify-center gap-2"
          >
            <UserIcon className="w-4 h-4" />
            Додати ще спеціаліста
          </button>
        )}
      </section>

      {/* Огляд тижня — згортанний блок */}
      {masters.length > 0 && (
        <section className="mt-6 rounded-2xl p-4 md:p-6 card-glass border border-white/10">
          <button
            type="button"
            onClick={() => setShowWeekOverview(!showWeekOverview)}
            className="w-full flex items-center justify-between gap-2 text-left"
          >
            <h2 className="text-base font-semibold text-white">Огляд тижня</h2>
            <span className={cn('text-gray-400 transition-transform', showWeekOverview && 'rotate-180')}>
              <ChevronDownIcon className="w-5 h-5" />
            </span>
          </button>
          {showWeekOverview && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[320px] text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-2 text-gray-400 font-medium">Спеціаліст</th>
                    {DAY_LABELS_SHORT.map((label) => (
                      <th key={label} className="py-2 px-1 text-center text-gray-400 font-medium w-14">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {masters.map((master) => (
                    <tr key={master.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 pr-2">
                        <button
                          type="button"
                          onClick={() => setScheduleModalMaster(master)}
                          className="text-left text-white font-medium hover:underline truncate max-w-[140px] block"
                        >
                          {master.name}
                        </button>
                      </td>
                      {DAY_KEYS.map((dayKey) => {
                        const daySchedule = getMasterScheduleForDay(master, dayKey)
                        const isWorking = daySchedule?.enabled
                        return (
                          <td key={dayKey} className="py-1.5 px-1 text-center">
                            <button
                              type="button"
                              onClick={() => setScheduleModalMaster(master)}
                              className={cn(
                                'w-full py-1.5 rounded-lg text-[10px] transition-colors',
                                isWorking
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-white/5 text-gray-500 border border-white/10'
                              )}
                            >
                              {isWorking ? `${daySchedule?.start?.slice(0, 5) || '—'}–${daySchedule?.end?.slice(0, 5) || '—'}` : '—'}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-500 mt-3">Клік по імені або клітинці — відкрити повний графік та виключення.</p>
            </div>
          )}
        </section>
      )}

      {scheduleModalMaster && business && (
        <MasterScheduleModal
          master={scheduleModalMaster}
          businessId={business.id}
          onClose={() => setScheduleModalMaster(null)}
          onSave={handleScheduleSave}
        />
      )}

      {showQuickMasterCard && business && (
        <QuickMasterCard
          businessId={business.id}
          editingMaster={editingMaster}
          onSuccess={handleQuickMasterSuccess}
          onCancel={() => { setShowQuickMasterCard(false); setEditingMaster(null) }}
        />
      )}
    </div>
  )
}
