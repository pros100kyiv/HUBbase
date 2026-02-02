'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/components/ui/toast'

declare global {
  interface Window {
    handleTelegramAuth?: (user: any) => void
  }
}

export function TelegramLoginButton() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

    if (!BOT_USERNAME) {
      console.warn('NEXT_PUBLIC_TELEGRAM_BOT_USERNAME не налаштовано')
      return
    }

    window.handleTelegramAuth = async (user: any) => {
      try {
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user),
        })

        const data = await response.json()

        if (!response.ok) {
          console.error('Telegram auth error:', data)
          toast({
            title: 'Помилка Telegram-авторизації',
            description: data.error || 'Не вдалося увійти через Telegram',
            type: 'error',
          })
          return
        }

        if (!data.business || !data.business.id || !data.business.name) {
          toast({
            title: 'Помилка',
            description: 'Невірні дані бізнесу від Telegram-авторизації',
            type: 'error',
          })
          return
        }

        // Зберігаємо бізнес так само, як при звичайному вході
        localStorage.setItem('business', JSON.stringify(data.business))

        toast({
          title: data.message || 'Вхід через Telegram успішний',
          type: 'success',
        })

        router.push('/dashboard')
      } catch (error) {
        console.error('Telegram auth error:', error)
        toast({
          title: 'Помилка Telegram-авторизації',
          description: 'Спробуйте ще раз або скористайтесь іншим способом входу',
          type: 'error',
        })
      }
    }

    if (!containerRef.current) return

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', BOT_USERNAME)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-userpic', 'false')
    script.setAttribute('data-onauth', 'window.handleTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')

    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(script)

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [router])

  return (
    <div className="w-full flex justify-center">
      <div ref={containerRef} />
    </div>
  )
}



