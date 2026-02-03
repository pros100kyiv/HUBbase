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
    const botName = 'xbasesbot' // Дефолтний бот
    const widgetId = `telegram-auth-${Date.now()}`
    widgetIdRef.current = widgetId

    // Глобальна функція для обробки авторизації
    ;(window as any)[`onTelegramAuth_${widgetId}`] = async (user: any) => {
      try {
        const response = await fetch('/api/auth/telegram-oauth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegramData: user })
        })
        
        const data = await response.json()
        
        if (response.ok && data.success) {
          if (data.business) {
            localStorage.setItem('business', JSON.stringify(data.business))
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
          window.location.href = '/dashboard'
        } else {
          alert(data.error || 'Помилка авторизації через Telegram')
        }
      } catch (error) {
        console.error('Telegram auth error:', error)
        alert('Помилка при авторизації через Telegram')
      }
    }

    if (!containerRef.current) return

    // Очищаємо контейнер
    containerRef.current.innerHTML = ''

    // Створюємо скрипт для Telegram Login Widget
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botName)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', `onTelegramAuth_${widgetId}(user)`)
    script.setAttribute('data-request-access', 'write')
    script.async = true

    containerRef.current.appendChild(script)

    return () => {
      // Cleanup
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
      if (widgetIdRef.current) {
        delete (window as any)[`onTelegramAuth_${widgetIdRef.current}`]
      }
    }
  }, [router, isRegister])

  return (
    <div className="w-full flex justify-center">
      {/* Telegram Login Widget - стилізується як кнопка */}
      <div 
        ref={containerRef} 
        className="[&>iframe]:!w-full [&>iframe]:!h-[48px] [&>iframe]:!rounded-lg [&>iframe]:!border-none"
      />
      <style jsx global>{`
        div[data-telegram-login] iframe {
          width: 100% !important;
          height: 48px !important;
          border-radius: 8px !important;
          border: none !important;
        }
      `}</style>
    </div>
  )
}

