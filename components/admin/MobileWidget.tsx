'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MobileWidgetProps {
  children?: ReactNode
  className?: string
  onClick?: () => void
  icon?: ReactNode
  title?: string
  subtitle?: string
  value?: string | number
  trend?: 'up' | 'down' | 'neutral'
  iconColor?: 'orange' | 'blue' | 'green' | 'purple' | 'pink' | 'cyan'
}

export function MobileWidget({
  children,
  className,
  onClick,
  icon,
  title,
  subtitle,
  value,
  trend,
  iconColor = 'orange',
}: MobileWidgetProps) {
  const baseClasses = 'rounded-candy-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 backdrop-blur-sm p-3 shadow-soft-xl transition-all duration-200 active:scale-[0.97] overflow-hidden'
  const clickableClasses = onClick ? 'cursor-pointer hover:shadow-soft-xl hover:-translate-y-0.5' : ''

  const iconGradientClasses = {
    orange: 'candy-orange text-white shadow-soft-lg',
    blue: 'candy-blue text-white shadow-soft-lg',
    green: 'candy-mint text-white shadow-soft-lg',
    purple: 'candy-purple text-white shadow-soft-lg',
    pink: 'candy-pink text-white shadow-soft-lg',
    cyan: 'candy-blue text-white shadow-soft-lg',
  }
  
  const valueGradientClasses = {
    orange: 'text-candy-orange',
    blue: 'text-candy-blue',
    green: 'text-candy-mint',
    purple: 'text-candy-purple',
    pink: 'text-candy-pink',
    cyan: 'text-candy-blue',
  }

  if (onClick || title || value) {
    return (
      <div
        onClick={onClick}
        className={cn(baseClasses, clickableClasses, className)}
      >
        {icon && (
          <div className="flex items-center justify-between mb-2">
            <div className={cn('w-10 h-10 md:w-11 md:h-11 rounded-candy-sm flex items-center justify-center overflow-hidden shadow-soft', iconGradientClasses[iconColor])}>
              {icon}
            </div>
            {trend && (
              <span
                className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full border',
                  trend === 'up' && 'text-candy-mint border-candy-mint bg-candy-mint/10',
                  trend === 'down' && 'text-red-500 border-red-500 bg-red-50',
                  trend === 'neutral' && 'text-gray-400 border-gray-300 bg-gray-50'
                )}
              >
                {trend === 'up' && '↑'}
                {trend === 'down' && '↓'}
                {trend === 'neutral' && '→'}
              </span>
            )}
          </div>
        )}
        {title && (
          <div className="mb-1.5">
            <p className="text-xs text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wider mb-0.5">
              {title}
            </p>
            {subtitle && (
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{subtitle}</p>
            )}
          </div>
        )}
        {value !== undefined && (
          <p className={cn("text-lg md:text-xl font-black", valueGradientClasses[iconColor])}>
            {value}
          </p>
        )}
        {children}
      </div>
    )
  }

  return (
    <div className={cn(baseClasses, className)}>
      {children}
    </div>
  )
}

