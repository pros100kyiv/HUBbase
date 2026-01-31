'use client'

import { useState } from 'react'
import { CalendarIcon, MoneyIcon, UsersIcon, StarIcon, ChevronDownIcon, ChevronUpIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

interface MasterProfileCardProps {
  master: {
    id: string
    name: string
    photo?: string
    bio?: string
    phone?: string
    isActive?: boolean
  }
  stats: {
    visits: number
    earned: number
    reviews: number
    clients: number
    services: number
    branches: number
  }
  onScheduleClick?: () => void
  onToggleActive?: (isActive: boolean) => void
}

export function MasterProfileCard({ master, stats, onScheduleClick, onToggleActive }: MasterProfileCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const isActive = master.isActive !== false

  return (
    <div className={cn(
      "card-candy card-candy-hover overflow-hidden",
      isExpanded && "shadow-soft-lg"
    )}>
      {/* Compact Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-candy-xs candy-purple overflow-hidden flex-shrink-0 shadow-soft-lg">
              {master.photo ? (
                <img
                  src={master.photo}
                  alt={master.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg text-white font-black">
                  {master.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name and Status */}
            <div className="flex-1 min-w-0 text-left">
              <h3 className="text-sm font-black text-foreground dark:text-white truncate mb-0.5">
                {master.name}
              </h3>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold",
                  isActive
                    ? 'bg-candy-mint/10 dark:bg-candy-mint/20 border-candy-mint text-candy-mint'
                    : 'bg-gray-200/50 dark:bg-gray-700/50 border-gray-400 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                )}>
                  <span className="text-[8px]">●</span>
                  <span>{isActive ? 'Працює' : 'Не працює'}</span>
                </div>
                {onToggleActive && (
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="relative inline-flex items-center cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => {
                        e.stopPropagation()
                        onToggleActive(e.target.checked)
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-candy-purple/50 rounded-full peer transition-colors duration-200 peer-checked:bg-candy-mint">
                      <div className="absolute top-[2px] left-[2px] bg-white dark:bg-gray-200 rounded-full h-4 w-4 transition-all duration-200 shadow-soft peer-checked:translate-x-4"></div>
                    </div>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Schedule Icon and Expand Arrow */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onScheduleClick?.()
              }}
              className="p-1.5 rounded-candy-xs bg-candy-purple/10 dark:bg-candy-purple/20 text-candy-purple hover:bg-candy-purple/20 dark:hover:bg-candy-purple/30 transition-colors"
              title="Графік роботи"
            >
              <CalendarIcon className="w-4 h-4" />
            </button>
            {isExpanded ? (
              <ChevronUpIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded Details - Shown when clicked */}
      {isExpanded && (
        <div className="px-2 pb-2 pt-0 border-t border-gray-200 dark:border-gray-700">
          {/* Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {/* Візити */}
            <div className="p-2 bg-candy-orange/10 dark:bg-candy-orange/20 rounded-candy-xs border border-candy-orange/30">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-6 h-6 rounded-candy-xs candy-orange flex items-center justify-center text-white shadow-soft-lg">
                  <CalendarIcon className="w-3 h-3" />
                </div>
                <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold">Візити</div>
              </div>
              <div className="text-base font-black text-candy-orange">{stats.visits}</div>
            </div>

            {/* Зароблено */}
            <div className="p-2 bg-candy-mint/10 dark:bg-candy-mint/20 rounded-candy-xs border border-candy-mint/30">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-6 h-6 rounded-candy-xs candy-mint flex items-center justify-center text-white shadow-soft-lg">
                  <MoneyIcon className="w-3 h-3" />
                </div>
                <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold">Зароблено</div>
              </div>
              <div className="text-sm font-black text-candy-mint truncate">{formatCurrency(stats.earned)}</div>
            </div>

            {/* Відгуки */}
            <div className="p-2 bg-candy-blue/10 dark:bg-candy-blue/20 rounded-candy-xs border border-candy-blue/30">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-6 h-6 rounded-candy-xs candy-blue flex items-center justify-center text-white shadow-soft-lg">
                  <StarIcon className="w-3 h-3" />
                </div>
                <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold">Відгуки</div>
              </div>
              <div className="text-base font-black text-candy-blue">{stats.reviews}</div>
            </div>

            {/* Клієнти */}
            <div className="p-2 bg-candy-purple/10 dark:bg-candy-purple/20 rounded-candy-xs border border-candy-purple/30">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-6 h-6 rounded-candy-xs candy-purple flex items-center justify-center text-white shadow-soft-lg">
                  <UsersIcon className="w-3 h-3" />
                </div>
                <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold">Клієнти</div>
              </div>
              <div className="text-base font-black text-candy-purple">{stats.clients}</div>
            </div>

            {/* Послуги */}
            <div className="p-2 bg-candy-pink/10 dark:bg-candy-pink/20 rounded-candy-xs border border-candy-pink/30 md:col-span-2">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-6 h-6 rounded-candy-xs candy-pink flex items-center justify-center text-white shadow-soft-lg">
                  <StarIcon className="w-3 h-3" />
                </div>
                <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold">Послуги</div>
              </div>
              <div className="text-base font-black text-candy-pink">{stats.services}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



