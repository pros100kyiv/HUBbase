'use client'

import { useState, useEffect } from 'react'
import { UserIcon, ChevronDownIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

interface AccountInfoProps {
  business: any
}

export function AccountInfo({ business }: AccountInfoProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !business) return null

  const displayName = business.name || 'Бізнес'
  
  // Визначаємо, чи це Telegram реєстрація
  const isTelegramRegistration = !!business.telegramId || !!business.telegramChatId || (business.email?.includes('@telegram') || business.email?.includes('telegram-'))
  
  // Отримуємо username з email (якщо email містить @telegram) або з business
  let displayIdentifier = business.email || ''
  if (isTelegramRegistration) {
    // Якщо email містить @telegram.xbase.online, витягуємо username
    if (business.email?.includes('@telegram.xbase.online')) {
      const username = business.email.split('@')[0]
      displayIdentifier = username ? `@${username}` : business.email
    } else if (business.email?.includes('telegram-')) {
      // Якщо email у форматі telegram-{id}@xbase.online, показуємо email
      displayIdentifier = business.email
    } else {
      // Якщо є username в business (зберігається при реєстрації)
      displayIdentifier = business.email || ''
    }
  }
  
  const avatar = business.avatar || business.logo

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-candy-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95"
      >
        {avatar ? (
          <img
            src={avatar}
            alt={displayName}
            className="w-6 h-6 md:w-7 md:h-7 rounded-full object-cover border border-gray-200 dark:border-gray-700"
            onError={(e) => {
              // Якщо зображення не завантажилося, показуємо іконку
              e.currentTarget.style.display = 'none'
              const parent = e.currentTarget.parentElement
              if (parent) {
                const icon = document.createElement('div')
                icon.className = 'w-6 h-6 md:w-7 md:h-7 rounded-full bg-gradient-to-br from-candy-blue to-candy-purple flex items-center justify-center'
                icon.innerHTML = '<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>'
                parent.insertBefore(icon, e.currentTarget)
              }
            }}
          />
        ) : (
          <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-gradient-to-br from-candy-blue to-candy-purple flex items-center justify-center">
            <UserIcon className="w-4 h-4 text-white" />
          </div>
        )}
        <div className="hidden md:block text-left">
          <div className="text-xs font-black text-gray-900 dark:text-white truncate max-w-[120px]">
            {displayName}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
            {displayIdentifier}
          </div>
        </div>
        <ChevronDownIcon className={cn(
          "w-3 h-3 text-gray-500 dark:text-gray-400 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-candy-sm shadow-soft-xl z-50 overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-candy-blue/10 to-candy-purple/10 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={displayName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-candy-blue"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const parent = e.currentTarget.parentElement
                      if (parent) {
                        const icon = document.createElement('div')
                        icon.className = 'w-12 h-12 rounded-full bg-gradient-to-br from-candy-blue to-candy-purple flex items-center justify-center'
                        icon.innerHTML = '<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>'
                        parent.insertBefore(icon, e.currentTarget)
                      }
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-candy-blue to-candy-purple flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-white" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-gray-900 dark:text-white truncate">
                    {displayName}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {displayIdentifier}
                  </div>
                </div>
              </div>
            </div>

            {/* Info Section */}
            <div className="p-4 space-y-2">
              {business.phone && (
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Телефон:</span>
                  <span>{business.phone}</span>
                </div>
              )}
              {business.businessIdentifier && (
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">ID:</span>
                  <span className="truncate font-bold text-candy-blue dark:text-blue-400">{business.businessIdentifier}</span>
                </div>
              )}
              {!business.businessIdentifier && business.slug && (
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">URL:</span>
                  <span className="truncate">{business.slug}</span>
                </div>
              )}
              {business.telegramChatId && (
                <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                  <span className="font-medium">✓ Telegram підключено</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-2">
              <button
                onClick={() => {
                  window.location.href = '/dashboard/settings'
                  setIsOpen(false)
                }}
                className="w-full px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-candy-xs transition-colors"
              >
                Налаштування
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('business')
                  window.location.href = '/login'
                }}
                className="w-full px-3 py-2 text-left text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-candy-xs transition-colors"
              >
                Вийти
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

