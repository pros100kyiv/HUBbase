'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export type StatusValue = 'Pending' | 'Confirmed' | 'Done' | 'Cancelled'

interface StatusOption {
  value: StatusValue
  label: string
  color: string
  show: boolean
}

interface StatusSwitcherProps {
  status: string
  isFromBooking?: boolean
  onStatusChange: (id: string, status: StatusValue) => void
  appointmentId: string
  disabled?: boolean
  size?: 'sm' | 'md'
}

const STATUS_CONFIG: Record<StatusValue, { label: string; color: string }> = {
  Pending: { label: 'Очікує', color: 'bg-orange-500/20 text-orange-400 border-orange-500/50' },
  Confirmed: { label: 'Підтверджено', color: 'bg-green-500/20 text-green-400 border-green-500/50' },
  Done: { label: 'Виконано', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
  Cancelled: { label: 'Скасовано', color: 'bg-red-500/20 text-red-400 border-red-500/50' },
}

function normalizeStatus(s: string): StatusValue {
  if (s === 'Очікує' || s === 'Pending') return 'Pending'
  if (s === 'Підтверджено' || s === 'Confirmed') return 'Confirmed'
  if (s === 'Виконано' || s === 'Done') return 'Done'
  if (s === 'Скасовано' || s === 'Cancelled') return 'Cancelled'
  return s as StatusValue
}

export function StatusSwitcher({
  status,
  isFromBooking = false,
  onStatusChange,
  appointmentId,
  disabled = false,
  size = 'md',
}: StatusSwitcherProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const rawStatus = normalizeStatus(status)
  // Очікує тільки для записів від клієнта. Pending+!isFromBooking показуємо як Підтверджено.
  const currentStatus: StatusValue =
    rawStatus === 'Pending' && !isFromBooking ? 'Confirmed' : rawStatus
  const isDone = currentStatus === 'Done'
  const isCancelled = currentStatus === 'Cancelled'

  const allOptions: StatusOption[] = [
    { value: 'Pending', label: 'Очікує', color: STATUS_CONFIG.Pending.color, show: isFromBooking },
    { value: 'Confirmed', label: 'Підтверджено', color: STATUS_CONFIG.Confirmed.color, show: true },
    { value: 'Done', label: 'Виконано', color: STATUS_CONFIG.Done.color, show: true },
    { value: 'Cancelled', label: 'Скасовано', color: STATUS_CONFIG.Cancelled.color, show: !isDone },
  ]
  const options = allOptions.filter((o) => o.show && o.value !== currentStatus)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [open])

  const handleSelect = (value: StatusValue) => {
    onStatusChange(appointmentId, value)
    setOpen(false)
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-[10px] min-w-[60px]' : 'px-2.5 py-1.5 text-xs min-w-[72px]'

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          if (!disabled) setOpen((v) => !v)
        }}
        disabled={disabled}
        title="Змінити статус"
        className={cn(
          'rounded-full border font-medium flex items-center justify-center transition-all touch-manipulation',
          'hover:ring-2 hover:ring-white/30 focus:outline-none focus:ring-2 focus:ring-white/50',
          disabled && 'opacity-50 cursor-not-allowed',
          sizeClasses,
          STATUS_CONFIG[currentStatus]?.color ?? 'bg-gray-500/20 text-gray-400 border-gray-500/50'
        )}
      >
        {STATUS_CONFIG[currentStatus]?.label ?? status}
      </button>

      {open && options.length > 0 && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[140px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-[#2A2A2A] border border-white/15 rounded-xl shadow-xl py-1 overflow-hidden">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelect(opt.value)
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-white/10 flex items-center gap-2',
                  opt.color
                )}
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    opt.value === 'Pending' && 'bg-orange-400',
                    opt.value === 'Confirmed' && 'bg-green-400',
                    opt.value === 'Done' && 'bg-blue-400',
                    opt.value === 'Cancelled' && 'bg-red-400'
                  )}
                />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
