'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns'
import { uk } from 'date-fns/locale'
import { XIcon, ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

interface DateRangePickerProps {
  onSelect: (startDate: Date | null, endDate: Date | null) => void
  onClose: () => void
  initialStartDate?: Date | null
  initialEndDate?: Date | null
}

export function DateRangePicker({
  onSelect,
  onClose,
  initialStartDate = null,
  initialEndDate = null,
}: DateRangePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [startDate, setStartDate] = useState<Date | null>(initialStartDate)
  const [endDate, setEndDate] = useState<Date | null>(initialEndDate)
  const [hoverDate, setHoverDate] = useState<Date | null>(null)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const handleDateClick = (day: Date) => {
    if (!startDate || (startDate && endDate)) {
      // Початок нового вибору
      setStartDate(day)
      setEndDate(null)
    } else if (startDate && !endDate) {
      // Вибір кінцевої дати
      if (day < startDate) {
        // Якщо вибрана дата раніше початкової, міняємо місцями
        setEndDate(startDate)
        setStartDate(day)
      } else {
        setEndDate(day)
      }
    }
  }

  const handleQuickSelect = (type: 'today' | 'tomorrow' | 'week' | 'month') => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    switch (type) {
      case 'today':
        setStartDate(today)
        setEndDate(today)
        break
      case 'tomorrow':
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        setStartDate(tomorrow)
        setEndDate(tomorrow)
        break
      case 'week':
        const weekStart = startOfWeek(today, { weekStartsOn: 1 })
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)
        setStartDate(weekStart)
        setEndDate(weekEnd)
        break
      case 'month':
        const monthStart = startOfMonth(today)
        const monthEnd = endOfMonth(today)
        setStartDate(monthStart)
        setEndDate(monthEnd)
        break
    }
  }

  const handleApply = () => {
    onSelect(startDate, endDate)
    onClose()
  }

  const handleClear = () => {
    setStartDate(null)
    setEndDate(null)
    onSelect(null, null)
    onClose()
  }

  const isDateInRange = (day: Date) => {
    if (!startDate) return false
    if (startDate && !endDate) {
      return isSameDay(day, startDate)
    }
    if (startDate && endDate) {
      return day >= startDate && day <= endDate
    }
    return false
  }

  const isDateStart = (day: Date) => {
    return startDate && isSameDay(day, startDate)
  }

  const isDateEnd = (day: Date) => {
    return endDate && isSameDay(day, endDate)
  }

  const isDateHovered = (day: Date) => {
    if (!startDate || endDate) return false
    if (!hoverDate) return false
    return day >= startDate && day <= hoverDate
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative w-full max-w-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-candy-lg shadow-soft-xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 rounded-candy-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <XIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>

        {/* Header */}
        <div className="mb-3">
          <h3 className="text-base font-black text-gray-900 dark:text-white mb-1">
            Вибір періоду
          </h3>
        </div>

        {/* Quick Select Buttons */}
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          <button
            onClick={() => handleQuickSelect('today')}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-candy-xs transition-all"
          >
            Сьогодні
          </button>
          <button
            onClick={() => handleQuickSelect('tomorrow')}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-candy-xs transition-all"
          >
            Завтра
          </button>
          <button
            onClick={() => handleQuickSelect('week')}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-candy-xs transition-all"
          >
            Цей тиждень
          </button>
          <button
            onClick={() => handleQuickSelect('month')}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-candy-xs transition-all"
          >
            Цей місяць
          </button>
        </div>

        {/* Calendar */}
        <div className="mb-3">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1 rounded-candy-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronLeftIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="text-sm font-black text-gray-900 dark:text-white">
              {format(currentMonth, 'LLLL yyyy', { locale: uk })}
            </div>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1 rounded-candy-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronRightIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day Headers */}
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day) => (
              <div key={day} className="text-center text-[10px] font-bold text-gray-500 dark:text-gray-400 py-1">
                {day}
              </div>
            ))}
            
            {/* Calendar Days */}
            {calendarDays.map((day) => {
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isToday = isSameDay(day, new Date())
              const inRange = isDateInRange(day)
              const isStart = isDateStart(day)
              const isEnd = isDateEnd(day)
              const isHovered = isDateHovered(day)

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => handleDateClick(day)}
                  onMouseEnter={() => setHoverDate(day)}
                  className={cn(
                    'relative p-1.5 rounded-candy-xs text-[10px] font-bold transition-all',
                    !isCurrentMonth && 'opacity-30',
                    isToday && 'ring-1 ring-candy-purple',
                    inRange && !isStart && !isEnd && 'bg-candy-purple/20',
                    isStart && 'bg-gradient-to-r from-candy-purple to-candy-blue text-white',
                    isEnd && 'bg-gradient-to-r from-candy-blue to-candy-purple text-white',
                    isHovered && !isStart && !isEnd && 'bg-candy-purple/10',
                    !inRange && isCurrentMonth && 'hover:bg-gray-100 dark:hover:bg-gray-700',
                    !inRange && isCurrentMonth && 'text-gray-900 dark:text-white'
                  )}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected Dates Display */}
        {(startDate || endDate) && (
          <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-900 rounded-candy-xs text-xs">
            <div className="text-gray-600 dark:text-gray-400 mb-1">Вибраний період:</div>
            <div className="font-bold text-gray-900 dark:text-white">
              {startDate && format(startDate, 'dd.MM.yyyy', { locale: uk })}
              {endDate && ` - ${format(endDate, 'dd.MM.yyyy', { locale: uk })}`}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleClear}
            className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white font-bold rounded-candy-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
          >
            Очистити
          </button>
          <button
            onClick={handleApply}
            className="flex-1 px-3 py-1.5 text-xs bg-gradient-to-r from-candy-purple to-candy-blue text-white font-black rounded-candy-xs shadow-soft-lg hover:shadow-soft-xl transition-all"
          >
            Застосувати
          </button>
        </div>
      </div>
    </div>
  )
}

