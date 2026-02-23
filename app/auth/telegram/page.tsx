'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BotIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { setBusinessData } from '@/lib/business-storage'

/**
 * Сторінка для автоматичної реєстрації/входу через Telegram OAuth
 * Використовується як callback URL для Telegram Login Widget
 */
function TelegramAuthContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Обробка авторизації...')

  const handleTelegramAuth = useCallback(async (telegramData: any) => {
    try {
      setStatus('loading')
      setMessage('Авторизація через Telegram...')

      const response = await fetch('/api/auth/telegram-oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramData
        })
      })

      let data: { success?: boolean; business?: unknown; action?: string; error?: string }
      try {
        data = await response.json()
      } catch {
        setStatus('error')
        setMessage(response.ok ? 'Невірна відповідь від сервера' : `Помилка ${response.status}. Спробуйте ще раз.`)
        return
      }

      if (response.ok && data.success) {
        setStatus('success')
        if (data.business) {
          setBusinessData(data.business, true)
        }
        if (data.action === 'register') {
          setMessage('Бізнес автоматично створено! Перенаправлення...')
        } else if (data.action === 'login') {
          setMessage('Вхід успішний! Перенаправлення...')
        } else {
          setMessage('Підключення успішне! Перенаправлення...')
        }
        setTimeout(() => {
          router.push('/dashboard')
        }, 1500)
      } else {
        setStatus('error')
        setMessage(data?.error || 'Помилка авторизації')
      }
    } catch (error: unknown) {
      console.error('Telegram auth error:', error)
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Помилка при обробці авторизації')
    }
  }, [router])

  useEffect(() => {
    // 1) Telegram при redirect передає дані в hash: #id=...&first_name=...&last_name=...&username=...&photo_url=...&auth_date=...&hash=...
    const hash = typeof window !== 'undefined' ? window.location.hash.substring(1) : ''
    const hashParams = new URLSearchParams(hash)
    const idFromHash = hashParams.get('id')

    let telegramData: Record<string, unknown> | null = null

    if (idFromHash) {
      telegramData = {
        id: idFromHash,
        first_name: hashParams.get('first_name') || undefined,
        last_name: hashParams.get('last_name') || undefined,
        username: hashParams.get('username') || undefined,
        photo_url: hashParams.get('photo_url') || undefined,
        auth_date: hashParams.get('auth_date') || undefined,
        hash: hashParams.get('hash') || undefined,
      }
    }

    // 2) Або дані в query (data=...) як JSON
    if (!telegramData && searchParams.get('data')) {
      try {
        const decoded = JSON.parse(decodeURIComponent(searchParams.get('data') || '{}'))
        if (decoded && decoded.id) telegramData = decoded
      } catch {
        // ігноруємо невалідний JSON
      }
    }

    if (telegramData && telegramData.id) {
      handleTelegramAuth(telegramData)
      return
    }

    // 3) Popup: дані з window.opener
    if (typeof window !== 'undefined' && window.opener && (window.opener as any).telegramAuthData) {
      const data = (window.opener as any).telegramAuthData
      handleTelegramAuth(data)
      return
    }

    setStatus('error')
    setMessage('Не вдалося отримати дані від Telegram')
  }, [searchParams, handleTelegramAuth])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="card-candy p-8 max-w-md w-full text-center">
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 bg-gradient-to-br from-candy-blue/20 to-candy-purple/20 rounded-full flex items-center justify-center">
            <BotIcon className="w-10 h-10 text-candy-blue" />
          </div>
        </div>

        {status === 'loading' && (
          <>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-4">
              Авторизація через Telegram
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-candy-purple"></div>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 className="text-2xl font-black text-green-600 dark:text-green-400 mb-4">
              ✅ Успішно!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-2xl font-black text-red-600 dark:text-red-400 mb-4">
              ❌ Помилка
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
            <Button
              onClick={() => router.push('/login')}
              className="w-full bg-gradient-to-r from-candy-blue to-candy-purple text-white"
            >
              Повернутися до входу
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default function TelegramAuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="card-candy p-8 max-w-md w-full text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-br from-candy-blue/20 to-candy-purple/20 rounded-full flex items-center justify-center">
              <BotIcon className="w-10 h-10 text-candy-blue" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-4">
            Авторизація через Telegram
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Завантаження...</p>
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-candy-purple"></div>
        </div>
      </div>
    }>
      <TelegramAuthContent />
    </Suspense>
  )
}

