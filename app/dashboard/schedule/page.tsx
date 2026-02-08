'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, startOfWeek, addDays, isToday, isSameDay } from 'date-fns'
import { uk } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ClockIcon, UserIcon, EditIcon, SettingsIcon, TrashIcon } from '@/components/icons'
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
const DAY_LABELS_FULL: Record<string, string> = {
  monday: 'Понеділок',
  tuesday: 'Вівторок',
  wednesday: 'Середа',
  thursday: 'Четвер',
  friday: "П'ятниця",
  saturday: 'Субота',
  sunday: 'Неділя',
}

function getDayKey(date: Date): string {
  const d = date.getDay()
  const dayIndex = d === 0 ? 6 : d - 1
  return DAY_KEYS[dayIndex]
}

function parseWorkingHours(workingHours?: string | null): WorkingHours | null {
  if (!workingHours) return null
  try {
    const parsed = JSON.parse(workingHours) as WorkingHours
    return parsed
  } catch {
    return null
  }
}

export default function SchedulePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [business, setBusiness] = useState<{ id: string } | null>(null)
  const [masters, setMasters] = useState<Master[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [scheduleModalMaster, setScheduleModalMaster] = useState<Master | null>(null)
  const [showQuickMasterCard, setShowQuickMasterCard] = useState(false)
  const [editingMaster, setEditingMaster] = useState<Master | null>(null)
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(-1)

  const selectedDate = selectedDayOffset === -1
    ? new Date()
    : addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), selectedDayOffset)

  const selectedDayKey = getDayKey(selectedDate)

  const loadMasters = useCallback(() => {
    if (!business?.id) return
    fetch(`/api/masters?businessId=${business.id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to fetch'))))
      .then((data: Master[]) => {
        const list = Array.isArray(data) ? data : []
        setMasters(list)
      })
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

  const isMasterWorkingOnDay = (master: Master, dayKey: string): boolean => {
    const hours = parseWorkingHours(master.workingHours)
    return hours?.[dayKey]?.enabled === true
  }

  const getMasterScheduleForDay = (master: Master, dayKey: string): DaySchedule | null => {
    const hours = parseWorkingHours(master.workingHours)
    const day = hours?.[dayKey]
    return day ?? null
  }

  const setMasterDayEnabled = async (master: Master, dayKey: string, enabled: boolean) => {
    if (!business?.id) return
    const hours = parseWorkingHours(master.workingHours) || {}
    const current = hours[dayKey] || { enabled: false, start: '09:00', end: '18:00' }
    const next: WorkingHours = {
      ...hours,
      [dayKey]: { ...current, enabled },
    }
    setSavingId(master.id)
    try {
      const res = await fetch(`/api/masters/${master.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          workingHours: JSON.stringify(next),
        }),
      })
      if (res.ok) {
        setMasters((prev) =>
          prev.map((m) =>
            m.id === master.id ? { ...m, workingHours: JSON.stringify(next) } : m
          )
        )
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: 'Помилка', description: (data as { error?: string }).error || 'Не вдалося оновити графік', type: 'error' })
      }
    } catch {
      toast({ title: 'Помилка', description: 'Не вдалося оновити графік', type: 'error' })
    } finally {
      setSavingId(null)
    }
  }

  const handleScheduleSave = (_?: string, __?: string) => {
    loadMasters()
    setScheduleModalMaster(null)
  }

  const handleDeleteMaster = async (master: Master) => {
    if (!business?.id) return
    if (!window.confirm('Видалити цього спеціаліста?')) return
    try {
      const response = await fetch(`/api/masters/${master.id}?businessId=${business.id}`, { method: 'DELETE' })
      if (response.ok) {
        loadMasters()
        toast({ title: 'Успішно!', description: 'Спеціаліста видалено', type: 'success' })
      } else {
        toast({ title: 'Помилка', description: 'Не вдалося видалити спеціаліста', type: 'error' })
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Завантаження...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="dashboard-grid">
        <div className="dashboard-main space-y-4 md:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h1 className="dashboard-page-title flex items-center gap-2">
              <ClockIcon className="w-6 h-6 md:w-7 md:h-7 text-white/90" />
              Графік роботи та спеціалісти
            </h1>
            <button
              type="button"
              onClick={() => { setEditingMaster(null); setShowQuickMasterCard(true) }}
              className="dashboard-btn-primary flex items-center gap-2"
            >
              <UserIcon className="w-5 h-5" />
              Додати спеціаліста
            </button>
          </div>

          {/* Короткий опис і підказки */}
          <div className="rounded-xl p-4 card-glass border border-white/10">
            <p className="text-sm text-gray-300 mb-1">
              Керуйте спеціалістами та їхнім графіком: робочі дні тижня, години та виключення по датах (відпустки, вихідні).
            </p>
            <p className="text-xs text-gray-500">
              Оберіть день зверху → вмикайте/вимикайте працює/не працює. Клік по годинах або кнопка «Редагувати» → повний графік та виключення.
            </p>
          </div>

          {/* Хто працює — вибір дня + список */}
          <div className="dashboard-card">
            <h2 className="dashboard-card-title mb-2">Хто працює</h2>
            <p className="text-xs text-gray-400 mb-4">
              Оберіть день і перемикайте «працює / вихідний». Щоб змінити години — натисніть по годинах або кнопку з олівцем.
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setSelectedDayOffset(-1)}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  selectedDayOffset === -1
                    ? 'bg-white text-black shadow-dashboard-button'
                    : 'border border-white/20 bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                )}
              >
                Сьогодні
              </button>
              {DAY_LABELS_SHORT.map((label, i) => (
                <button
                  key={label}
                  onClick={() => setSelectedDayOffset(i)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    selectedDayOffset === i
                      ? 'bg-white text-black shadow-dashboard-button'
                      : 'border border-white/20 bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="text-sm text-gray-400 mb-4">
              {isToday(selectedDate)
                ? 'Сьогодні'
                : format(selectedDate, 'EEEE, d MMMM', { locale: uk })}
              {' · '}
              <span className="text-white font-medium">{selectedDayKey ? DAY_LABELS_FULL[selectedDayKey] : ''}</span>
            </div>

            {masters.length === 0 ? (
              <div className="py-8 text-center rounded-xl bg-white/5 border border-white/10">
                <UserIcon className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400 mb-4">Немає спеціалістів</p>
                <button
                  type="button"
                  onClick={() => { setEditingMaster(null); setShowQuickMasterCard(true) }}
                  className="dashboard-btn-primary"
                >
                  Додати спеціаліста
                </button>
              </div>
            ) : (
              <ul className="space-y-2">
                {masters.map((master) => {
                  const working = isMasterWorkingOnDay(master, selectedDayKey)
                  const schedule = getMasterScheduleForDay(master, selectedDayKey)
                  const isSaving = savingId === master.id
                  return (
                    <li
                      key={master.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                        working
                          ? 'bg-white/5 border-white/15'
                          : 'bg-white/[0.02] border-white/10'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setMasterDayEnabled(master, selectedDayKey, !working)}
                        disabled={isSaving}
                        className={cn(
                          'w-10 h-6 rounded-full transition-colors flex-shrink-0 relative',
                          working ? 'bg-green-500/80' : 'bg-white/20'
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                            working ? 'left-5' : 'left-1'
                          )}
                        />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{master.name}</p>
                        {working && schedule ? (
                          <button
                            type="button"
                            onClick={() => setScheduleModalMaster(master)}
                            className="text-xs text-gray-400 hover:text-emerald-400 hover:underline transition-colors text-left"
                            title="Змінити години"
                          >
                            {schedule.start} – {schedule.end}
                          </button>
                        ) : (
                          <p className="text-xs text-gray-500">Вихідний</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setScheduleModalMaster(master)}
                          className="p-2 rounded-lg border border-white/20 bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white transition-colors"
                          title="Редагувати графік (години та виключення)"
                        >
                          <EditIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingMaster(master); setShowQuickMasterCard(true) }}
                          className="p-2 rounded-lg border border-white/20 bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white transition-colors"
                          title="Профіль"
                        >
                          <SettingsIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMaster(master)}
                          className="p-2 rounded-lg border border-white/20 bg-white/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Видалити"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Сітка тижня */}
          {masters.length > 0 && (
            <div className="dashboard-card">
              <h2 className="dashboard-card-title mb-2">Тиждень</h2>
              <p className="text-xs text-gray-400 mb-4">
                Огляд по днях. Клік по імені або по клітинці дня — відкрити графік та виключення.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 px-2 text-gray-400 font-medium">Спеціаліст</th>
                      {DAY_KEYS.map((key, i) => (
                        <th key={key} className="py-2 px-1 text-center text-gray-400 font-medium w-[72px]">
                          {DAY_LABELS_SHORT[i]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {masters.map((master) => (
                      <tr key={master.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 px-2">
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
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-white/5 text-gray-500 border border-white/10'
                                )}
                              >
                                {isWorking ? `${daySchedule?.start || '—'}–${daySchedule?.end || '—'}` : '—'}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="dashboard-sidebar space-y-4">
          <div className="dashboard-card">
            <h3 className="dashboard-card-title mb-3">Спеціалісти</h3>
            {masters.length === 0 ? (
              <p className="text-sm text-gray-400">Додайте спеціалістів нижче.</p>
            ) : (
              <ul className="space-y-2">
                {masters.map((master) => (
                  <li key={master.id} className="flex items-center gap-3 p-2 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/5 transition-colors">
                    {master.photo ? (
                      <img src={master.photo} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-white/10" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {master.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{master.name}</p>
                      <div className="flex gap-1.5 mt-0.5">
                        <button
                          type="button"
                          onClick={() => setScheduleModalMaster(master)}
                          className="text-[10px] font-medium text-emerald-400 hover:underline"
                        >
                          Графік
                        </button>
                        <span className="text-gray-600">·</span>
                        <button
                          type="button"
                          onClick={() => { setEditingMaster(master); setShowQuickMasterCard(true) }}
                          className="text-[10px] font-medium text-gray-400 hover:text-white hover:underline"
                        >
                          Профіль
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => { setEditingMaster(null); setShowQuickMasterCard(true) }}
              className="w-full mt-4 dashboard-btn-secondary flex items-center justify-center gap-2"
            >
              <UserIcon className="w-4 h-4" />
              Додати спеціаліста
            </button>
          </div>
        </div>
      </div>

      {scheduleModalMaster && business && (
        <MasterScheduleModal
          master={scheduleModalMaster}
          businessId={business.id}
          otherMasters={masters.filter((m) => m.id !== scheduleModalMaster.id)}
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
