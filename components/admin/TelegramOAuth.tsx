'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { BotIcon, CheckIcon, XIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Динамічний імпорт toast для уникнення помилок SSR
let toast: any = null
if (typeof window !== 'undefined') {
  import('@/components/ui/toast').then((module) => {
    toast = module.toast
  }).catch(() => {
    console.warn('Failed to load toast module')
  })
}

interface TelegramOAuthProps {
  businessId: string
  onConnected: (data: any) => void
}

export function TelegramOAuth({ businessId, onConnected }: TelegramOAuthProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [botName, setBotName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showWidget, setShowWidget] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const scriptRef = useRef<HTMLScriptElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)

  const checkConnection = useCallback(async () => {
    if (!businessId) return
    
    try {
      const response = await fetch(`/api/telegram/connection?businessId=${businessId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.connected && data.user) {
          setIsConnected(true)
          setUserData(data.user)
        } else {
          setIsConnected(false)
          setUserData(null)
        }
      }
    } catch (error) {
      console.error('Error checking connection:', error)
      setIsConnected(false)
    }
  }, [businessId])

  const fetchBotName = useCallback(async () => {
    if (!businessId) return
    
    try {
      const response = await fetch(`/api/telegram/bot-name?businessId=${businessId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.botName) {
          setBotName(data.botName)
          setError(null)
        } else {
          setError('Telegram бот не налаштований. Будь ласка, налаштуйте бота в налаштуваннях.')
        }
      } else {
        setError('Не вдалося завантажити налаштування бота')
      }
    } catch (error) {
      console.error('Error fetching bot name:', error)
      setError('Не вдалося завантажити налаштування бота')
    }
  }, [businessId])

  useEffect(() => {
    if (!businessId) return
    
    let mounted = true
    
    const fetchData = async () => {
      try {
        await Promise.all([
          checkConnection(),
          fetchBotName()
        ])
      } catch (error) {
        if (mounted) {
          console.error('Error initializing Telegram OAuth:', error)
        }
      }
    }
    
    fetchData()
    
    return () => {
      mounted = false
    }
  }, [businessId, checkConnection, fetchBotName])

  // Налаштування глобальної функції для Telegram OAuth
  useEffect(() => {
    if (typeof window === 'undefined' || !businessId) return

    // Створюємо унікальний ID для цього екземпляра компонента
    const widgetId = `telegram-auth-${businessId}-${Math.random().toString(36).substr(2, 9)}`
    widgetIdRef.current = widgetId

    console.log('[TelegramOAuth] Setting up auth handler with widgetId:', widgetId)

    // Глобальна функція для обробки авторизації
    const authHandler = async (user: any) => {
      console.log('[TelegramOAuth] Auth handler called with user:', user)
      try {
        if (!user || !user.id) {
          throw new Error('Некоректні дані від Telegram')
        }

        setLoading(true)
        console.log('[TelegramOAuth] Sending request to /api/telegram/oauth')
        const response = await fetch('/api/telegram/oauth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId,
            telegramData: user
          })
        })
        
        console.log('[TelegramOAuth] Response status:', response.status)
        
        if (response.ok) {
          const data = await response.json()
          console.log('[TelegramOAuth] Success, data:', data)
          setIsConnected(true)
          setUserData(data.user || data.telegramUser)
          onConnected(data)
          setShowWidget(false)
          try {
            const toastModule = await import('@/components/ui/toast')
            toastModule.toast({ title: 'Telegram підключено!', type: 'success' })
          } catch (e) {
            console.error('Error showing success toast:', e)
          }
          await checkConnection()
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Не вдалося підключити' }))
          const errorMessage = errorData.error || 'Не вдалося підключити'
          console.error('[TelegramOAuth] Error response:', errorData)
          setError(errorMessage)
          try {
            const toastModule = await import('@/components/ui/toast')
            toastModule.toast({ title: 'Помилка', description: errorMessage, type: 'error' })
          } catch (e) {
            console.error('Error showing error toast:', e)
          }
        }
      } catch (error: any) {
        console.error('[TelegramOAuth] Error connecting Telegram:', error)
        const errorMessage = error.message || 'Помилка підключення'
        setError(errorMessage)
        try {
          const toastModule = await import('@/components/ui/toast')
          toastModule.toast({ title: 'Помилка', description: errorMessage, type: 'error' })
        } catch (e) {
          console.error('Error showing error toast:', e)
        }
      } finally {
        setLoading(false)
      }
    }

    // Зберігаємо функцію глобально
    const functionName = `onTelegramAuth_${widgetId}`
    ;(window as any)[functionName] = authHandler
    console.log('[TelegramOAuth] Global function registered:', functionName)
    console.log('[TelegramOAuth] Function available:', typeof (window as any)[functionName])

    return () => {
      // Cleanup: видаляємо глобальну функцію
      if (typeof window !== 'undefined' && widgetIdRef.current) {
        const cleanupFunctionName = `onTelegramAuth_${widgetIdRef.current}`
        delete (window as any)[cleanupFunctionName]
        console.log('[TelegramOAuth] Cleanup: removed function', cleanupFunctionName)
        widgetIdRef.current = null
      }
    }
  }, [businessId, onConnected, checkConnection])

  // Завантаження Telegram Widget скрипта
  useEffect(() => {
    if (!showWidget || !botName || !containerRef.current || typeof window === 'undefined' || !widgetIdRef.current) {
      return
    }

    const container = containerRef.current
    const widgetId = widgetIdRef.current
    const functionName = `onTelegramAuth_${widgetId}`
    
    console.log('[TelegramOAuth] Loading widget with:', { botName, widgetId, functionName })
    
    // Перевіряємо, чи функція доступна перед завантаженням скрипта
    if (typeof (window as any)[functionName] !== 'function') {
      console.error('[TelegramOAuth] Auth handler function not found!', functionName)
      setError('Помилка налаштування. Спробуйте оновити сторінку.')
      setLoading(false)
      setShowWidget(false)
      return
    }

    let script: HTMLScriptElement | null = null

    // Видаляємо попередній скрипт, якщо він існує
    if (scriptRef.current) {
      const oldScript = scriptRef.current
      // Перевіряємо, чи скрипт дійсно є дочірнім елементом перед видаленням
      if (oldScript.parentNode === container) {
        try {
          container.removeChild(oldScript)
        } catch (e) {
          // Ігноруємо помилки видалення
          console.warn('[TelegramOAuth] Error removing old script:', e)
        }
      }
      scriptRef.current = null
    }

    // Створюємо новий скрипт
    script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botName)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', `${functionName}(user)`)
    script.setAttribute('data-request-access', 'write')
    script.async = true
    
    script.onerror = async () => {
      console.error('[TelegramOAuth] Script load error')
      setError('Не вдалося завантажити Telegram Widget')
      setLoading(false)
      setShowWidget(false)
      try {
        const toastModule = await import('@/components/ui/toast')
        toastModule.toast({ title: 'Помилка', description: 'Не вдалося завантажити Telegram Widget', type: 'error' })
      } catch (e) {
        console.error('Error showing toast:', e)
      }
    }
    
    script.onload = () => {
      console.log('[TelegramOAuth] Widget script loaded')
      setLoading(false)
    }

    // Додаємо скрипт до контейнера
    console.log('[TelegramOAuth] Appending script to container')
    container.appendChild(script)
    scriptRef.current = script

    return () => {
      // Cleanup: видаляємо скрипт при unmount або зміні залежностей
      if (script && script.parentNode === container) {
        try {
          container.removeChild(script)
          console.log('[TelegramOAuth] Script removed in cleanup')
        } catch (e) {
          // Ігноруємо помилки видалення (може бути вже видалено React)
          console.warn('[TelegramOAuth] Error removing script in cleanup:', e)
        }
      }
      if (scriptRef.current === script) {
        scriptRef.current = null
      }
    }
  }, [showWidget, botName])

  const handleTelegramAuth = () => {
    if (typeof window === 'undefined') return
    
    if (!botName) {
      const showToast = async () => {
        try {
          const toastModule = await import('@/components/ui/toast')
          toastModule.toast({ 
            title: 'Помилка', 
            description: 'Telegram бот не налаштований. Будь ласка, налаштуйте бота спочатку.', 
            type: 'error' 
          })
        } catch (e) {
          console.error('Error showing toast:', e)
          setError('Telegram бот не налаштований. Будь ласка, налаштуйте бота спочатку.')
        }
      }
      showToast()
      return
    }

    if (!businessId) {
      setError('Business ID не вказано')
      return
    }

    setLoading(true)
    setError(null)
    setShowWidget(true)
  }

  const handleDisconnect = async () => {
    if (!businessId) return
    
    try {
      const response = await fetch('/api/telegram/oauth', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId })
      })
      
      if (response.ok) {
        setIsConnected(false)
        setUserData(null)
        try {
          const toastModule = await import('@/components/ui/toast')
          toastModule.toast({ title: 'Telegram відключено', type: 'success' })
        } catch (e) {
          console.error('Error showing toast:', e)
        }
        await checkConnection()
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Не вдалося відключити' }))
        setError(errorData.error || 'Не вдалося відключити')
        try {
          const toastModule = await import('@/components/ui/toast')
          toastModule.toast({ title: 'Помилка', description: errorData.error || 'Не вдалося відключити', type: 'error' })
        } catch (e) {
          console.error('Error showing toast:', e)
        }
      }
    } catch (error: any) {
      console.error('Error disconnecting:', error)
      setError(error.message || 'Не вдалося відключити')
      try {
        const toastModule = await import('@/components/ui/toast')
        toastModule.toast({ title: 'Помилка', description: 'Не вдалося відключити', type: 'error' })
      } catch (e) {
        console.error('Error showing toast:', e)
      }
    }
  }

  return (
    <div className="card-candy p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BotIcon className="w-5 h-5 text-candy-blue" />
          <h3 className="text-lg font-black text-gray-900 dark:text-white">Telegram OAuth</h3>
        </div>
        {isConnected ? (
          <div className="flex items-center gap-2 text-green-500">
            <CheckIcon className="w-4 h-4" />
            <span className="text-xs font-bold">Підключено</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-400">
            <XIcon className="w-4 h-4" />
            <span className="text-xs font-bold">Не підключено</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-candy-xs mb-4">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            ⚠️ {error}
          </p>
        </div>
      )}

      {isConnected && userData ? (
        <div className="space-y-3">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-candy-xs">
            <p className="text-sm font-bold text-green-800 dark:text-green-200 mb-1">
              ✅ Telegram успішно підключено
            </p>
            <div className="text-xs text-green-700 dark:text-green-300 space-y-1">
              <p><strong>Ім'я:</strong> {userData.firstName || ''} {userData.lastName || ''}</p>
              <p><strong>Username:</strong> @{userData.username || 'не вказано'}</p>
              <p><strong>ID:</strong> {userData.telegramId?.toString() || userData.id}</p>
            </div>
          </div>
          <Button
            onClick={handleDisconnect}
            className="w-full bg-red-500 hover:bg-red-600 text-white"
          >
            Відключити
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Швидко підключіть свій Telegram акаунт для отримання сповіщень та управління ботом
          </p>
          {!botName && !error && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-candy-xs">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                ⏳ Завантаження налаштувань бота...
              </p>
            </div>
          )}
          <div className="flex justify-center min-h-[50px]">
            {!showWidget && !loading && botName && (
              <Button
                onClick={handleTelegramAuth}
                className="w-full bg-gradient-to-r from-candy-blue to-candy-purple text-white"
                disabled={!botName}
              >
                <BotIcon className="w-4 h-4 mr-2" />
                Підключити Telegram
              </Button>
            )}
            {loading && !showWidget && (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-candy-purple"></div>
                <p className="text-xs text-gray-500 mt-2">Підключення...</p>
              </div>
            )}
            {/* Контейнер для Telegram Widget - React не контролює його вміст */}
            <div 
              ref={containerRef} 
              className="telegram-widget-container"
              suppressHydrationWarning
            />
          </div>
        </div>
      )}
    </div>
  )
}

