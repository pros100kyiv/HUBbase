'use client'

import { useEffect, useRef, useState } from 'react'

interface TelegramAuthButtonProps {
  text?: string
  isRegister?: boolean
}

export function TelegramAuthButton({ text, isRegister = false }: TelegramAuthButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return

    const botName = 'xbasesbot'

    // Глобальна функція для обробки авторизації
    ;(window as any).onTelegramAuth = async (user: any) => {
      try {
        setIsLoading(true)
        console.log('[TelegramAuthButton] OAuth callback:', user)
        
        // Отримуємо збережені deviceId та businessId (якщо є)
        const pendingDeviceId = localStorage.getItem('pendingDeviceId')
        const pendingBusinessId = localStorage.getItem('pendingBusinessId')
        
        const response = await fetch('/api/auth/telegram-oauth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            telegramData: user,
            deviceId: pendingDeviceId,
            businessId: pendingBusinessId
          })
        })
        
        // Очищаємо збережені дані після використання
        if (pendingDeviceId) localStorage.removeItem('pendingDeviceId')
        if (pendingBusinessId) localStorage.removeItem('pendingBusinessId')
        
        const data = await response.json()
        
        if (response.ok && data.success) {
          if (data.business) {
            localStorage.setItem('business', JSON.stringify(data.business))
            console.log('[TelegramAuthButton] Business saved')
          }
          
          // Перенаправлення на dashboard
          console.log('[TelegramAuthButton] Redirecting to dashboard...')
          window.location.replace('/dashboard')
        } else {
          console.error('[TelegramAuthButton] Error:', data.error)
          // Якщо помилка - перенаправляємо на сторінку реєстрації з повідомленням
          const errorMsg = data.error || 'Помилка авторизації через Telegram'
          window.location.replace(`/register?error=${encodeURIComponent(errorMsg)}`)
        }
      } catch (error) {
        console.error('[TelegramAuthButton] Error:', error)
        const errorMsg = error instanceof Error ? error.message : 'Помилка при авторизації через Telegram'
        // Перенаправляємо на сторінку реєстрації з повідомленням про помилку
        window.location.replace(`/register?error=${encodeURIComponent(errorMsg)}`)
      }
    }

    // Очищаємо контейнер
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }

    // Створюємо скрипт для Telegram Login Widget
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botName)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-userpic', 'false')
    script.async = true

    if (containerRef.current) {
      containerRef.current.appendChild(script)
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
      if (typeof window !== 'undefined') {
        delete (window as any).onTelegramAuth
      }
    }
  }, [])

  return (
    <div className="w-full relative min-h-[52px]">
      {/* Telegram Login Widget - прихований */}
      <div 
        ref={containerRef} 
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 1 }}
      />
      {/* Власна кнопка - overlay */}
      <div
        className="absolute inset-0 w-full h-full min-h-[52px] py-3 rounded-xl bg-white text-gray-700 font-medium flex items-center justify-center gap-3 hover:bg-gray-50 transition-all shadow-md cursor-pointer border border-white/20"
        style={{ zIndex: 2, pointerEvents: 'none' }}
      >
        {/* Telegram іконка */}
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.13-.31-1.09-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"
            fill="#0088cc"
          />
        </svg>
        <span>{text || (isRegister ? 'Зареєструватися через Telegram' : 'Увійти через Telegram')}</span>
      </div>
      <style jsx global>{`
        div[data-telegram-login] {
          opacity: 0 !important;
          pointer-events: auto !important;
        }
        div[data-telegram-login] iframe {
          width: 100% !important;
          height: 52px !important;
          border-radius: 12px !important;
          border: none !important;
          background: transparent !important;
          pointer-events: auto !important;
        }
      `}</style>
    </div>
  )
}
