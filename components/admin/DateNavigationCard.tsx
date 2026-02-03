'use client'

import { useState } from 'react'
import { format, addDays, subDays, isSameDay } from 'date-fns'
import { uk } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface DateNavigationCardProps {
  onDateSelect?: (date: Date) => void
}

export function DateNavigationCard({ onDateSelect }: DateNavigationCardProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const today = new Date()
  
  const prevDay = subDays(currentDate, 1)
  const nextDay = addDays(currentDate, 1)
  const isToday = isSameDay(currentDate, today)

  const handleDateClick = (date: Date) => {
    setCurrentDate(date)
    onDateSelect?.(date)
  }

  const handlePrev = () => {
    const newDate = subDays(currentDate, 1)
    setCurrentDate(newDate)
    onDateSelect?.(newDate)
  }

  const handleNext = () => {
    const newDate = addDays(currentDate, 1)
    setCurrentDate(newDate)
    onDateSelect?.(newDate)
  }

  return (
    <div className="space-y-2">
      {/* Previous Day */}
      <button
        onClick={handlePrev}
        className="w-full rounded-lg p-3 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-gray-400">
            {format(prevDay, 'EEEE', { locale: uk })}
          </div>
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </div>
        <div className="text-sm font-semibold text-white">
          {format(prevDay, 'd')}
        </div>
        <div className="text-xs text-gray-400">
          {format(prevDay, 'LLLL', { locale: uk })}
        </div>
      </button>

      {/* Current Day */}
      <button
        onClick={() => handleDateClick(currentDate)}
        className={cn(
          'w-full rounded-lg p-3 border transition-colors text-left',
          isToday
            ? 'bg-blue-500/20 border-blue-500/50'
            : 'bg-white/10 border-white/20 hover:bg-white/15'
        )}
      >
        <div className="flex items-center justify-between mb-1">
          <div className={cn(
            'text-xs font-medium',
            isToday ? 'text-blue-400' : 'text-gray-300'
          )}>
            {format(currentDate, 'EEEE', { locale: uk })}
          </div>
        </div>
        <div className={cn(
          'text-lg font-bold mb-1',
          isToday ? 'text-blue-400' : 'text-white'
        )}>
          {format(currentDate, 'd')}
        </div>
        <div className={cn(
          'text-xs',
          isToday ? 'text-blue-300' : 'text-gray-400'
        )}>
          {format(currentDate, 'LLLL', { locale: uk })}
        </div>
      </button>

      {/* Next Day */}
      <button
        onClick={handleNext}
        className="w-full rounded-lg p-3 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-gray-400">
            {format(nextDay, 'EEEE', { locale: uk })}
          </div>
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className="text-sm font-semibold text-white">
          {format(nextDay, 'd')}
        </div>
        <div className="text-xs text-gray-400">
          {format(nextDay, 'LLLL', { locale: uk })}
        </div>
      </button>
    </div>
  )
}

