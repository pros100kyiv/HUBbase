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
  const baseClasses = 'rounded-xl bg-white border border-gray-200 p-6 transition-all duration-200 overflow-hidden'
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
    orange: 'text-orange-600',
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    pink: 'text-pink-600',
    cyan: 'text-cyan-600',
  }

  if (onClick || title || value) {
    return (
      <div
        onClick={onClick}
        className={cn(baseClasses, clickableClasses, className)}
        style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}
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
                  trend === 'up' && 'text-green-600 bg-green-50',
                  trend === 'down' && 'text-red-600 bg-red-50',
                  trend === 'neutral' && 'text-gray-400 bg-gray-100'
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
            <p className="text-sm text-gray-600 font-medium mb-1">
              {title}
            </p>
            {subtitle && (
              <p className="text-xs text-gray-500 leading-tight">{subtitle}</p>
            )}
          </div>
        )}
        {value !== undefined && (
          <p className={cn("text-2xl font-bold text-black", valueGradientClasses[iconColor])}>
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

