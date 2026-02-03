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
  const baseClasses = 'rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm transition-all duration-200 overflow-hidden'
  const clickableClasses = onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''

  const iconGradientClasses = {
    orange: 'gradient-orange text-white shadow-md',
    blue: 'gradient-blue text-white shadow-md',
    green: 'gradient-green text-white shadow-md',
    purple: 'gradient-purple text-white shadow-md',
    pink: 'gradient-pink text-white shadow-md',
    cyan: 'gradient-blue text-white shadow-md',
  }
  
  const valueGradientClasses = {
    orange: 'text-orange-600 dark:text-orange-400',
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    purple: 'text-purple-600 dark:text-purple-400',
    pink: 'text-pink-600 dark:text-pink-400',
    cyan: 'text-cyan-600 dark:text-cyan-400',
  }

  if (onClick || title || value) {
    return (
      <div
        onClick={onClick}
        className={cn(baseClasses, clickableClasses, className)}
      >
        {icon && (
          <div className="flex items-center justify-between mb-4">
            <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden', iconGradientClasses[iconColor])}>
              {icon}
            </div>
            {trend && (
              <span
                className={cn(
                  'text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1',
                  trend === 'up' && 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
                  trend === 'down' && 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
                  trend === 'neutral' && 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700'
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
          <div className="mb-2">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mb-1">
              {title}
            </p>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-500 leading-tight">{subtitle}</p>
            )}
          </div>
        )}
        {value !== undefined && (
          <p className={cn("text-2xl font-bold text-slate-900 dark:text-slate-50", valueGradientClasses[iconColor])}>
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

