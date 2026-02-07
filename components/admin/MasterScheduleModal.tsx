'use client'

import { useState, useEffect } from 'react'
import { XIcon, CalendarIcon, ClockIcon, CheckIcon } from '@/components/icons'
import { ModalPortal } from '@/components/ui/modal-portal'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'
import { ErrorToast } from '@/components/ui/error-toast'

interface MasterScheduleModalProps {
  master: {
    id: string
    name: string
    workingHours?: string | null
    blockedPeriods?: string | null
  }
  businessId: string
  onClose: () => void
  onSave: (workingHours?: string, blockedPeriods?: string) => void
}

interface WorkingHours {
  [key: string]: {
    enabled: boolean
    start: string
    end: string
  }
}

const DAYS = [
  { key: 'monday', label: 'Понеділок' },
  { key: 'tuesday', label: 'Вівторок' },
  { key: 'wednesday', label: 'Середа' },
  { key: 'thursday', label: 'Четвер' },
  { key: 'friday', label: 'П\'ятниця' },
  { key: 'saturday', label: 'Субота' },
  { key: 'sunday', label: 'Неділя' },
]

export function MasterScheduleModal({
  master,
  businessId,
  onClose,
  onSave,
}: MasterScheduleModalProps) {
  const [workingHours, setWorkingHours] = useState<WorkingHours>({})
  const [blockedPeriods, setBlockedPeriods] = useState<Array<{ start: string; end: string }>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showErrorToast, setShowErrorToast] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [newBlockedStart, setNewBlockedStart] = useState('')
  const [newBlockedEnd, setNewBlockedEnd] = useState('')

  useEffect(() => {
    // Завантажуємо поточний графік
    try {
      if (master.workingHours) {
        const parsed = typeof master.workingHours === 'string' 
          ? JSON.parse(master.workingHours) 
          : master.workingHours
        setWorkingHours(parsed || {})
      } else {
        // Дефолтний графік: Пн-Пт 9:00-18:00
        const defaultHours: WorkingHours = {}
        DAYS.forEach((day, index) => {
          if (index < 5) {
            defaultHours[day.key] = {
              enabled: true,
              start: '09:00',
              end: '18:00',
            }
          } else {
            defaultHours[day.key] = {
              enabled: false,
              start: '09:00',
              end: '18:00',
            }
          }
        })
        setWorkingHours(defaultHours)
      }

      if (master.blockedPeriods) {
        const parsed = typeof master.blockedPeriods === 'string' 
          ? JSON.parse(master.blockedPeriods) 
          : master.blockedPeriods
        setBlockedPeriods(Array.isArray(parsed) ? parsed : [])
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

  const handleAddBlockedPeriod = () => {
    if (!newBlockedStart || !newBlockedEnd) {
      setErrorMessage('Введіть дату початку та кінця')
      setShowErrorToast(true)
      return
    }

    if (new Date(newBlockedStart) >= new Date(newBlockedEnd)) {
      setErrorMessage('Дата початку повинна бути раніше дати кінця')
      setShowErrorToast(true)
      return
    }

    setBlockedPeriods((prev) => [
      ...prev,
      { start: newBlockedStart, end: newBlockedEnd },
    ])
    setNewBlockedStart('')
    setNewBlockedEnd('')
  }

  const handleRemoveBlockedPeriod = (index: number) => {
    setBlockedPeriods((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setShowErrorToast(false)

    try {
      const workingHoursJson = JSON.stringify(workingHours)
      const blockedPeriodsJson = JSON.stringify(blockedPeriods)

      const response = await fetch(`/api/masters/${master.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          workingHours: workingHoursJson,
          blockedPeriods: blockedPeriodsJson,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Не вдалося зберегти графік')
      }

      toast({
        title: 'Успішно!',
        description: 'Графік роботи оновлено',
        type: 'success',
      })

      onSave(workingHoursJson, blockedPeriodsJson)
      onClose()
    } catch (error) {
      console.error('Error saving schedule:', error)
      const errorMsg = error instanceof Error ? error.message : 'Не вдалося зберегти графік'
      setErrorMessage(errorMsg)
      setShowErrorToast(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ModalPortal>
      <div className="modal-overlay sm:!p-4">
        <div className="relative w-[95%] sm:w-full sm:max-w-lg sm:my-auto modal-content modal-dialog text-white animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <XIcon className="w-5 h-5 text-gray-400" />
        </button>

        <div className="mb-4">
          <h2 className="text-lg font-bold text-white mb-1">
            Графік роботи
          </h2>
          <p className="text-sm text-gray-400 truncate">
            {master.name}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">
              Робочі години
            </h3>
            <div className="space-y-2">
              {DAYS.map((day) => {
                const dayHours = workingHours[day.key] || { enabled: false, start: '09:00', end: '18:00' }
                return (
                  <div
                    key={day.key}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                      dayHours.enabled
                        ? 'bg-white/10 border-white/20'
                        : 'bg-white/5 border-white/10'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={dayHours.enabled}
                      onChange={() => handleDayToggle(day.key)}
                      className="w-4 h-4 rounded border-white/30 bg-white/10 text-green-500 focus:ring-green-500/50"
                    />
                    <label className="flex-1 text-sm font-medium text-white">
                      {day.label}
                    </label>
                    {dayHours.enabled && (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={dayHours.start}
                          onChange={(e) => handleTimeChange(day.key, 'start', e.target.value)}
                          className="w-20 px-2 py-1.5 text-xs rounded-lg border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                        />
                        <span className="text-gray-400 text-xs">–</span>
                        <input
                          type="time"
                          value={dayHours.end}
                          onChange={(e) => handleTimeChange(day.key, 'end', e.target.value)}
                          className="w-20 px-2 py-1.5 text-xs rounded-lg border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-2">
              Заблоковані періоди
            </h3>
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                <input
                  type="datetime-local"
                  value={newBlockedStart}
                  onChange={(e) => setNewBlockedStart(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                />
                <input
                  type="datetime-local"
                  value={newBlockedEnd}
                  onChange={(e) => setNewBlockedEnd(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                />
                <button
                  type="button"
                  onClick={handleAddBlockedPeriod}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors whitespace-nowrap"
                >
                  Додати
                </button>
              </div>
              {blockedPeriods.length > 0 && (
                <div className="space-y-2">
                  {blockedPeriods.map((period, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-xl bg-red-500/10 border border-red-500/20"
                    >
                      <div className="text-xs text-white flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {new Date(period.start).toLocaleString('uk-UA', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="text-gray-400 truncate">
                          до {new Date(period.end).toLocaleString('uk-UA', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBlockedPeriod(index)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

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

        {/* Error Toast */}
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

