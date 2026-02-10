'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

interface XbaseLogoProps {
  className?: string
  /** Розмір: sm, md, lg */
  size?: 'sm' | 'md' | 'lg'
  /** compact: тільки іконка (сайдбар). Інакше — іконка + надпис Xbase */
  compact?: boolean
  /** variant: gradient (navbar), light (лендінг, авторизація — світлий текст на темному фоні) */
  variant?: 'gradient' | 'light'
}

const sizeClasses = {
  sm: { icon: 'w-7 h-7', text: 'text-base' },
  md: { icon: 'w-8 h-8', text: 'text-lg' },
  lg: { icon: 'w-10 h-10', text: 'text-xl' },
}

/**
 * Об'ємний значок: X із заповнених смуг + тінь для глибини. Кольори без змін.
 */
function XbaseIcon({ className, size = 'sm' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const id = useId().replace(/:/g, '')
  const iconSize = sizeClasses[size].icon
  return (
    <svg
      className={cn(iconSize, 'flex-shrink-0', className)}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={`xbase-g1-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id={`xbase-g2-${id}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
        <filter id={`xbase-shadow-${id}`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0.8" dy="1" stdDeviation="0.7" floodOpacity="0.45" floodColor="#0f172a" />
        </filter>
      </defs>
      <g filter={`url(#xbase-shadow-${id})`}>
        <path d="M7 7l14 14" stroke={`url(#xbase-g1-${id})`} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M21 7L7 21" stroke={`url(#xbase-g2-${id})`} strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

export function XbaseLogo({ className, size = 'sm', compact = false, variant = 'gradient' }: XbaseLogoProps) {
  const { icon, text } = sizeClasses[size]
  const textClass = variant === 'light'
    ? 'font-bold tracking-tight text-white'
    : 'font-bold tracking-tight text-black dark:text-white'
  return (
    <div
      className={cn('flex items-center gap-2', className)}
      aria-label="Xbase"
    >
      <div className={cn(icon, 'flex items-center justify-center')}>
        <XbaseIcon size={size} />
      </div>
      {!compact && (
        <span className={cn(textClass, text)} style={{ letterSpacing: '-0.04em' }}>
          Xbase
        </span>
      )}
    </div>
  )
}

/** Іконка окремо для favicon / compact */
export { XbaseIcon }
