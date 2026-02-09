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
  /** xs = тільки крапка + шеврон (мінімум місця), sm = короткий текст, md = повний текст */
  size?: 'xs' | 'sm' | 'md'
  /** Якщо вартість не вказана і користувач обирає «Виконано» — викликається замість onStatusChange (відкрити модалку введення вартості) */
  customPrice?: number | null
  onDoneWithoutPrice?: (id: string) => void
}

const STATUS_CONFIG: Record<StatusValue, { label: string; labelShort: string; dotClass: string; chipClass: string }> = {
  Pending: { label: 'Очікує', labelShort: 'Очік.', dotClass: 'bg-amber-400', chipClass: 'bg-amber-500/15 text-amber-400 border-amber-500/40' },
  Confirmed: { label: 'Підтверджено', labelShort: 'Підт.', dotClass: 'bg-emerald-400', chipClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
  Done: { label: 'Виконано', labelShort: 'Вик.', dotClass: 'bg-sky-400', chipClass: 'bg-sky-500/15 text-sky-400 border-sky-500/40' },
  Cancelled: { label: 'Скасовано', labelShort: 'Скас.', dotClass: 'bg-rose-400', chipClass: 'bg-rose-500/15 text-rose-400 border-rose-500/40' },
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
  customPrice,
  onDoneWithoutPrice,
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

  const effectiveSize = size ?? 'md'
  const cfg = STATUS_CONFIG[currentStatus] ?? { label: status, labelShort: status.slice(0, 4), dotClass: 'bg-gray-400', chipClass: 'bg-white/10 text-gray-400 border-white/10' }
  const buttonLabel = effectiveSize === 'xs' ? null : effectiveSize === 'sm' ? cfg.labelShort : cfg.label

  useEffect(() => {
    if (open && buttonRef.current && options.length > 0) {
      const rect = buttonRef.current.getBoundingClientRect()
      const dropdownWidth = 152
      const itemHeight = 36
      const headerHeight = 32
      const dropdownHeight = Math.min(headerHeight + options.length * itemHeight, 280)
      const inset = 12
      const vw = typeof window !== 'undefined' ? window.innerWidth : 320
      const vh = typeof window !== 'undefined' ? window.innerHeight : 568
      const spaceBelow = vh - rect.bottom - inset
      const spaceAbove = rect.top - inset
      const openUp = spaceBelow < dropdownHeight && spaceAbove >= dropdownHeight
      const left = Math.max(inset, Math.min(rect.right - dropdownWidth, vw - dropdownWidth - inset))
      const topDown = rect.bottom + 4
      const topUp = rect.top - dropdownHeight - 4
      const top = openUp
        ? Math.max(inset, topUp)
        : Math.min(vh - dropdownHeight - inset, topDown)
      setPosition({
        top,
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
    setOpen(false)
    if (value === 'Done' && (customPrice == null || customPrice <= 0) && onDoneWithoutPrice) {
      onDoneWithoutPrice(appointmentId)
      return
    }
    onStatusChange(appointmentId, value)
  }

  const dropdownContent = open && options.length > 0 && position && typeof document !== 'undefined' && (
    createPortal(
      <div
        id={`status-dropdown-${appointmentId}`}
        className="dropdown-fixed dropdown-theme fixed min-w-[140px] max-w-[200px] max-h-[70vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 rounded-lg py-1.5"
        style={{
          top: position.top,
          left: position.left,
          zIndex: 150,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2.5 py-1 border-b border-white/10 mb-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Статус</span>
        </div>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleSelect(opt.value)
            }}
            className="w-full px-3 py-2 min-h-[36px] sm:min-h-[40px] text-left text-xs sm:text-sm font-medium text-white hover:bg-white/10 flex items-center gap-2.5 transition-colors rounded-md touch-manipulation"
          >
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_CONFIG[opt.value].dotClass)} />
            {STATUS_CONFIG[opt.value].label}
          </button>
        ))}
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
        title={cfg.label}
        aria-label={`Статус: ${cfg.label}. Змінити`}
        className={cn(
          'inline-flex items-center rounded-md border font-medium transition-all touch-manipulation',
          'hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-1 focus:ring-offset-[#1A1A1A]',
          disabled && 'opacity-60 cursor-not-allowed',
          effectiveSize === 'xs' && 'p-1.5 min-w-0',
          effectiveSize === 'sm' && 'gap-1 px-1.5 py-0.5 text-[10px] min-h-[28px]',
          effectiveSize === 'md' && 'gap-1.5 px-2 py-1 text-xs min-h-[32px]',
          cfg.chipClass
        )}
      >
        <span className={cn('rounded-full flex-shrink-0', effectiveSize === 'xs' ? 'w-2 h-2' : 'w-1.5 h-1.5', cfg.dotClass)} />
        {buttonLabel != null && <span className="max-w-[64px] sm:max-w-[72px] truncate">{buttonLabel}</span>}
        {!disabled && options.length > 0 && (
          <svg className={cn('flex-shrink-0 opacity-70', effectiveSize === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {dropdownContent}
    </div>
  )
}
