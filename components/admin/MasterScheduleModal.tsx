'use client'

import { useState, useEffect } from 'react'
import { XIcon, CalendarIcon, ClockIcon, CheckIcon } from '@/components/icons'
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
  onSave: (workingHours: string, blockedPeriods: string) => void
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-candy-lg shadow-soft-xl p-3 sm:p-4 max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 p-1.5 sm:p-2 rounded-candy-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
        >
          <XIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 dark:text-gray-400" />
        </button>

        {/* Header */}
        <div className="mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-black text-candy-blue dark:text-blue-400 mb-1">
            Графік роботи
          </h2>
          <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 truncate">
            {master.name}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          {/* Working Hours */}
          <div>
            <h3 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white mb-1.5 sm:mb-2">
              Робочі години
            </h3>
            <div className="space-y-1 sm:space-y-1.5">
              {DAYS.map((day) => {
                const dayHours = workingHours[day.key] || { enabled: false, start: '09:00', end: '18:00' }
                return (
                  <div
                    key={day.key}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-candy-xs border transition-all",
                      dayHours.enabled
                        ? "bg-candy-mint/10 border-candy-mint"
                        : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={dayHours.enabled}
                      onChange={() => handleDayToggle(day.key)}
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-gray-300 dark:border-gray-700 text-candy-blue focus:ring-candy-blue touch-manipulation"
                    />
                    <label className="flex-1 text-[10px] sm:text-xs font-bold text-gray-900 dark:text-white">
                      {day.label}
                    </label>
                    {dayHours.enabled && (
                      <div className="flex items-center gap-1 sm:gap-1.5">
                        <input
                          type="time"
                          value={dayHours.start}
                          onChange={(e) => handleTimeChange(day.key, 'start', e.target.value)}
                          className="w-16 sm:w-20 px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] border border-gray-300 dark:border-gray-700 rounded-candy-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-candy-blue"
                        />
                        <span className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400">-</span>
                        <input
                          type="time"
                          value={dayHours.end}
                          onChange={(e) => handleTimeChange(day.key, 'end', e.target.value)}
                          className="w-16 sm:w-20 px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] border border-gray-300 dark:border-gray-700 rounded-candy-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-candy-blue"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Blocked Periods */}
          <div>
            <h3 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white mb-1.5 sm:mb-2">
              Заблоковані періоди
            </h3>
            <div className="space-y-1.5 sm:space-y-2">
              {/* Add New Blocked Period */}
              <div className="flex flex-col sm:flex-row gap-1 sm:gap-1.5 p-1.5 sm:p-2 bg-gray-50 dark:bg-gray-900 rounded-candy-xs border border-gray-200 dark:border-gray-700">
                <input
                  type="datetime-local"
                  value={newBlockedStart}
                  onChange={(e) => setNewBlockedStart(e.target.value)}
                  placeholder="Початок"
                  className="flex-1 px-1.5 py-1 text-[9px] sm:text-[10px] border border-gray-300 dark:border-gray-700 rounded-candy-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-candy-blue"
                />
                <input
                  type="datetime-local"
                  value={newBlockedEnd}
                  onChange={(e) => setNewBlockedEnd(e.target.value)}
                  placeholder="Кінець"
                  className="flex-1 px-1.5 py-1 text-[9px] sm:text-[10px] border border-gray-300 dark:border-gray-700 rounded-candy-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-candy-blue"
                />
                <button
                  type="button"
                  onClick={handleAddBlockedPeriod}
                  className="px-2 py-1 bg-gradient-to-r from-candy-purple to-candy-blue text-white font-bold rounded-candy-xs text-[9px] sm:text-[10px] shadow-soft-lg hover:shadow-soft-xl transition-all whitespace-nowrap touch-manipulation"
                >
                  Додати
                </button>
              </div>

              {/* Blocked Periods List */}
              {blockedPeriods.length > 0 && (
                <div className="space-y-1 sm:space-y-1.5 max-h-24 sm:max-h-32 overflow-y-auto">
                  {blockedPeriods.map((period, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-1 sm:p-1.5 bg-red-50 dark:bg-red-900/20 rounded-candy-xs border border-red-200 dark:border-red-800"
                    >
                      <div className="text-[9px] sm:text-[10px] text-gray-900 dark:text-white flex-1 min-w-0">
                        <div className="font-bold truncate">
                          {new Date(period.start).toLocaleString('uk-UA', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        <div className="text-[8px] sm:text-[9px] text-gray-600 dark:text-gray-400 truncate">
                          до {new Date(period.end).toLocaleString('uk-UA', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBlockedPeriod(index)}
                        className="px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-candy-xs transition-colors ml-1 touch-manipulation min-w-[24px]"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white font-bold rounded-candy-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-3 py-1.5 text-xs bg-gradient-to-r from-candy-purple to-candy-blue text-white font-black rounded-candy-xs shadow-soft-xl hover:shadow-soft-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Збереження...
                </>
              ) : (
                <>
                  <CheckIcon className="w-3 h-3" />
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
  )
}

