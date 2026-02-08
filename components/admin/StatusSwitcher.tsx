'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export type StatusValue = 'Pending' | 'Confirmed' | 'Done' | 'Cancelled'

interface StatusOption {
  value: StatusValue
  label: string
  dotClass: string
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

const STATUS_CONFIG: Record<StatusValue, { label: string; dotClass: string; chipClass: string }> = {
  Pending: { label: 'Очікує', dotClass: 'bg-amber-400', chipClass: 'bg-amber-500/15 text-amber-400 border-amber-500/40' },
  Confirmed: { label: 'Підтверджено', dotClass: 'bg-emerald-400', chipClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
  Done: { label: 'Виконано', dotClass: 'bg-sky-400', chipClass: 'bg-sky-500/15 text-sky-400 border-sky-500/40' },
  Cancelled: { label: 'Скасовано', dotClass: 'bg-rose-400', chipClass: 'bg-rose-500/15 text-rose-400 border-rose-500/40' },
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
  const [position, setPosition] = useState<{ top: number; left: number; openUp: boolean } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const rawStatus = normalizeStatus(status)
  const currentStatus: StatusValue =
    rawStatus === 'Pending' && !isFromBooking ? 'Confirmed' : rawStatus
  const isDone = currentStatus === 'Done'

  const allOptions: StatusOption[] = [
    { value: 'Pending', label: 'Очікує', dotClass: STATUS_CONFIG.Pending.dotClass, show: true },
    { value: 'Confirmed', label: 'Підтверджено', dotClass: STATUS_CONFIG.Confirmed.dotClass, show: true },
    { value: 'Done', label: 'Виконано', dotClass: STATUS_CONFIG.Done.dotClass, show: true },
    { value: 'Cancelled', label: 'Скасувати', dotClass: STATUS_CONFIG.Cancelled.dotClass, show: !isDone },
  ]
  const options = allOptions.filter((o) => o.show && o.value !== currentStatus)

  useEffect(() => {
    if (open && buttonRef.current && options.length > 0) {
      const rect = buttonRef.current.getBoundingClientRect()
      const dropdownWidth = 160
      const dropdownHeight = options.length * 44 + 48
      const spaceBelow = window.innerHeight - rect.bottom
      const openUp = spaceBelow < dropdownHeight && rect.top > spaceBelow
      const left = Math.max(8, Math.min(rect.right - dropdownWidth, window.innerWidth - dropdownWidth - 8))
      setPosition({
        top: openUp ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left,
        openUp,
      })
    } else {
      setPosition(null)
    }
  }, [open, options.length])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target)) return
      const dropdown = document.getElementById(`status-dropdown-${appointmentId}`)
      if (dropdown?.contains(target)) return
      setOpen(false)
    }
    if (open) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [open, appointmentId])

  const handleSelect = (value: StatusValue) => {
    onStatusChange(appointmentId, value)
    setOpen(false)
  }

  const cfg = STATUS_CONFIG[currentStatus] ?? { label: status, dotClass: 'bg-gray-400', chipClass: 'bg-white/10 text-gray-400 border-white/10' }

  const dropdownContent = open && options.length > 0 && position && typeof document !== 'undefined' && (
    createPortal(
      <div
        id={`status-dropdown-${appointmentId}`}
        className="fixed z-[9999] min-w-[160px] animate-in fade-in zoom-in-95 duration-150"
        style={{ top: position.top, left: position.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-xl border border-white/20 bg-[#1E1E1E] shadow-2xl shadow-black/50 py-2">
          <div className="px-3 py-1.5 mb-1 border-b border-white/10">
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Змінити статус</span>
          </div>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleSelect(opt.value)
              }}
              className="w-full px-4 py-2.5 text-left text-sm font-medium text-white hover:bg-white/10 flex items-center gap-3 transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', STATUS_CONFIG[opt.value].dotClass)} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>,
      document.body
    )
  )

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          if (!disabled) setOpen((v) => !v)
        }}
        disabled={disabled}
        title="Змінити статус"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border font-medium transition-all touch-manipulation',
          'hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-1 focus:ring-offset-[#1A1A1A]',
          disabled && 'opacity-60 cursor-not-allowed',
          size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs',
          cfg.chipClass
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dotClass)} />
        <span className="max-w-[72px] truncate">{cfg.label}</span>
        {!disabled && options.length > 0 && (
          <svg className="w-3 h-3 flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {dropdownContent}
    </div>
  )
}
