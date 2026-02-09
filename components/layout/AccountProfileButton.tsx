'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface AccountProfileButtonProps {
  business: any
  router: ReturnType<typeof useRouter>
}

/** Короткий внутрішній ID (перші 8 символів UUID) для відображення */
function shortId(id: string | undefined): string {
  if (!id || typeof id !== 'string') return '—'
  return id.length > 8 ? id.slice(0, 8) : id
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

  const displayName = business?.name || 'Бізнес'
  const displayIdentifier = business?.email || ''
  const avatar = business?.avatar || business?.logo

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

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[min(320px,calc(100vw-2rem))] max-h-[min(70vh,calc(100dvh-6rem))] overflow-y-auto dropdown-theme rounded-xl shadow-xl z-[150] overflow-hidden">
          {/* Заголовок: аватар + назва */}
          <div className="p-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              {avatar ? (
                <img
                  src={avatar}
                  alt={displayName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white/20 shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center border border-white/30 shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{displayName}</div>
                {displayIdentifier ? (
                  <div className="text-xs text-gray-400 truncate">{displayIdentifier}</div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Блок даних: ID, внутрішній номер, телефон — завжди присутні */}
          <div className="p-4 space-y-3 border-b border-white/10">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 px-0.5">
              Дані акаунту
            </div>
            <div className="grid gap-2.5">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-gray-400 shrink-0">ID:</span>
                <span className="font-mono font-semibold text-blue-400 truncate text-right" title={business?.businessIdentifier || business?.id}>
                  {business?.businessIdentifier || shortId(business?.id) || '—'}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-gray-400 shrink-0">Внутрішній номер:</span>
                <span className="font-mono text-white truncate text-right" title={business?.id}>
                  {shortId(business?.id)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-gray-400 shrink-0">Телефон:</span>
                <span className="truncate text-right text-white">
                  {business?.phone || '—'}
                </span>
              </div>
            </div>
            {business?.slug && (
              <div className="flex items-baseline justify-between gap-2 text-xs pt-0.5">
                <span className="text-gray-400 shrink-0">URL:</span>
                <span className="truncate text-right text-gray-300">{business.slug}</span>
              </div>
            )}
            {business?.telegramChatId && (
              <div className="flex items-center gap-1.5 text-xs text-green-400 pt-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
                Telegram підключено
              </div>
            )}
          </div>

          {/* Кнопки */}
          <div className="p-2">
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

