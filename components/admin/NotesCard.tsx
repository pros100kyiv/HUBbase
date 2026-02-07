'use client'

import { useState } from 'react'
import { format, addDays, startOfDay, isSameDay } from 'date-fns'
import { uk } from 'date-fns/locale'
import { ModalPortal } from '@/components/ui/modal-portal'

interface NotesCardProps {
  businessId: string
}

export function NotesCard({ businessId }: NotesCardProps) {
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()))
  const [showDatePicker, setShowDatePicker] = useState(false)

  const handleDateChange = (days: number) => {
    const newDate = addDays(currentDate, days)
    setCurrentDate(startOfDay(newDate))
  }

  const handleDateSelect = (date: Date) => {
    setCurrentDate(startOfDay(date))
    setShowDatePicker(false)
  }

  const isToday = isSameDay(currentDate, new Date())

  return (
    <>
      <div className="rounded-xl p-4 md:p-6 card-glass">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="text-base md:text-lg font-semibold text-white" style={{ letterSpacing: '-0.01em' }}>
            Нотатки
          </h3>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => handleDateChange(-1)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={() => setShowDatePicker(true)}
            className="px-2 md:px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-xs md:text-sm text-white flex-1 min-w-0"
          >
            {isToday ? (
              <span className="truncate">Сьогодні, {format(currentDate, 'd MMM', { locale: uk })}</span>
            ) : (
              <span className="truncate">{format(currentDate, 'EEEE, d MMM', { locale: uk })}</span>
            )}
          </button>

          <button
            onClick={() => handleDateChange(1)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => setShowDatePicker(false)}>
            <div
              className="relative w-[95%] sm:w-full max-w-sm modal-content modal-dialog animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Виберіть дату</h3>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-2">
                <input
                  type="date"
                  value={format(currentDate, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value)
                    handleDateSelect(newDate)
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-white/20"
                />
                <button
                  onClick={() => {
                    handleDateSelect(startOfDay(new Date()))
                    setShowDatePicker(false)
                  }}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors"
                >
                  Сьогодні
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  )
}
