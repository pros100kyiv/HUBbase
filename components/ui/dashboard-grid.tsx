'use client'

import { ReactNode, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface DashboardGridProps {
  children: ReactNode
  className?: string
  columns?: number
}

export function DashboardGrid({ children, className, columns = 4 }: DashboardGridProps) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 2 && 'grid-cols-1 md:grid-cols-2',
        columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
        className
      )}
    >
      {children}
    </div>
  )
}

interface DashboardCardProps {
  children: ReactNode
  title?: string
  className?: string
  draggable?: boolean
  cardId?: string
  onDrag?: (id: string, position: { x: number; y: number }) => void
}

export function DashboardCard({
  children,
  title,
  className,
  draggable = false,
  cardId,
  onDrag,
}: DashboardCardProps) {
  return (
    <div
      className={cn(
        'bg-gray-800 dark:bg-gray-900 border border-gray-700 rounded-candy-lg backdrop-blur-sm shadow-soft-xl',
        'p-4 transition-all duration-200 hover:shadow-soft-2xl hover:-translate-y-0.5',
        draggable && 'cursor-move',
        className
      )}
    >
      {title && (
        <h3 className="text-subheading mb-3 text-candy-blue dark:text-blue-400">
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}

