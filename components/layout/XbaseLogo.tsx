'use client'

import { cn } from '@/lib/utils'

interface XbaseLogoProps {
  className?: string
  /** Compact: only icon. Default: icon + wordmark */
  compact?: boolean
  /** Size: sm (sidebar), md (navbar), lg */
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: { icon: 'w-7 h-7', text: 'text-lg' },
  md: { icon: 'w-8 h-8', text: 'text-xl' },
  lg: { icon: 'w-10 h-10', text: 'text-2xl' },
}

/** Minimal geometric X mark — two strokes, rounded caps */
function XbaseMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  )
}

export function XbaseLogo({ className, compact = false, size = 'sm' }: XbaseLogoProps) {
  const { icon, text } = sizeClasses[size]
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-lg flex-shrink-0',
          'bg-white/12 text-white border border-white/10',
          icon
        )}
      >
        <XbaseMark className="w-[55%] h-[55%]" />
      </div>
      {!compact && (
        <span
          className={cn(
            'font-semibold text-white tracking-tight',
            text
          )}
          style={{ letterSpacing: '-0.03em' }}
        >
          xbase
        </span>
      )}
    </div>
  )
}
