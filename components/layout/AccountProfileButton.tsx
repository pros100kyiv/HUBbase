'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface AccountProfileButtonProps {
  business: any
  router: ReturnType<typeof useRouter>
}

export function AccountProfileButton({ business, router }: AccountProfileButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const displayName = business.name || 'Бізнес'
  const displayIdentifier = business.email || ''
  const avatar = business.avatar || business.logo

  const handleLogout = () => {
    localStorage.removeItem('business')
    setIsOpen(false)
    router.push('/login')
  }

  const handleSettings = () => {
    setIsOpen(false)
    router.push('/dashboard/settings')
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="touch-target p-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center"
        aria-label="Профіль"
      >
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
          {avatar ? (
            <img
              src={avatar}
              alt={displayName}
              className="w-full h-full rounded-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right)-1rem)] bg-[#2A2A2A] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="p-4 bg-white/5 border-b border-white/10">
            <div className="flex items-center gap-3">
              {avatar ? (
                <img
                  src={avatar}
                  alt={displayName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white/20"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                  {displayName}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {displayIdentifier}
                </div>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="p-4 space-y-2">
            {business.phone && (
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <span className="font-medium">Телефон:</span>
                <span>{business.phone}</span>
              </div>
            )}
            {business.businessIdentifier && (
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <span className="font-medium">ID:</span>
                <span className="truncate font-bold text-blue-400">{business.businessIdentifier}</span>
              </div>
            )}
            {!business.businessIdentifier && business.slug && (
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <span className="font-medium">URL:</span>
                <span className="truncate">{business.slug}</span>
              </div>
            )}
            {business.telegramChatId && (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <span className="font-medium">✓ Telegram підключено</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="border-t border-white/10 p-2">
            <button
              onClick={handleSettings}
              className="touch-target w-full px-3 py-3 min-h-[44px] text-left text-sm font-medium text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              Налаштування
            </button>
            <button
              onClick={handleLogout}
              className="touch-target w-full px-3 py-3 min-h-[44px] text-left text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              Вийти
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

