'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface TelegramAuthButtonProps {
  text?: string
  isRegister?: boolean
}

export function TelegramAuthButton({ text, isRegister = false }: TelegramAuthButtonProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return

    const botName = 'xbasesbot' // Дефолтний бот

    // Глобальна функція для обробки авторизації (статична назва, як Telegram вимагає)
    ;(window as any).onTelegramAuth = async (user: any) => {
      try {
        console.log('[TelegramAuthButton] ✅ OAuth callback received:', user, 'isRegister:', isRegister)
        
        const response = await fetch('/api/auth/telegram-oauth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            telegramData: user,
            forceRegister: isRegister // Примусово створюємо бізнес при реєстрації
          })
        })
        
        const data = await response.json()
        
        if (response.ok && data.success) {
          if (data.business) {
            localStorage.setItem('business', JSON.stringify(data.business))
            console.log('[TelegramAuthButton] ✅ Business saved to localStorage')
          }
          
          // Показуємо повідомлення
          try {
            const toastModule = await import('@/components/ui/toast')
            toastModule.toast({
              title: 'Успішно!',
              description: isRegister 
                ? 'Бізнес автоматично створено через Telegram!'
                : 'Вхід через Telegram успішний!',
              type: 'success'
            })
          } catch (e) {
            console.warn('Toast not available')
          }
          
          // Автоматично переходимо на dashboard
          console.log('[TelegramAuthButton] ✅ Redirecting to dashboard...')
          window.location.href = '/dashboard'
        } else {
          console.error('[TelegramAuthButton] ❌ Error:', data.error)
          alert(data.error || 'Помилка авторизації через Telegram')
        }
      } catch (error) {
        console.error('[TelegramAuthButton] ❌ Telegram auth error:', error)
        alert('Помилка при авторизації через Telegram')
      }
    }

    console.log('[TelegramAuthButton] ✅ Global function registered: onTelegramAuth')

    // Очищаємо контейнер
    containerRef.current.innerHTML = ''

    // Створюємо скрипт для Telegram Login Widget
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botName)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)') // Використовуємо статичну назву
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-userpic', 'false') // Вимикаємо відображення аватара останнього користувача
    script.async = true

    script.onerror = () => {
      console.error('[TelegramAuthButton] ❌ Failed to load Telegram Widget script')
    }

    script.onload = () => {
      console.log('[TelegramAuthButton] ✅ Telegram Widget script loaded')
    }

    containerRef.current.appendChild(script)

    return () => {
      // Cleanup
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
      // Видаляємо глобальну функцію при unmount
      if (typeof window !== 'undefined') {
        delete (window as any).onTelegramAuth
        console.log('[TelegramAuthButton] Cleanup: removed global onTelegramAuth')
      }
    }
  }, [isRegister]) // Видаляємо router з залежностей, він не потрібен

  return (
    <div className="w-full">
      {/* Telegram Login Widget - стилізується як біла кнопка як Google */}
      <div 
        ref={containerRef} 
        className="[&>iframe]:!w-full [&>iframe]:!h-[48px] [&>iframe]:!rounded-lg [&>iframe]:!border-none [&>iframe]:!bg-white"
      />
      <style jsx global>{`
        div[data-telegram-login] iframe {
          width: 100% !important;
          height: 48px !important;
          border-radius: 8px !important;
          border: none !important;
          background: white !important;
        }
      `}</style>
    </div>
  )
}

