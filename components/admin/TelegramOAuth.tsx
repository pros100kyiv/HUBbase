'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { BotIcon, CheckIcon, XIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { setBusinessData } from '@/lib/business-storage'

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
    console.log('[TelegramOAuth] BusinessId:', businessId)

    // Глобальна функція для обробки авторизації
    // Telegram Widget вимагає просте ім'я onTelegramAuth
    const authHandler = async (user: any) => {
      console.log('[TelegramOAuth] ✅ Auth handler CALLED with user:', user)
      
      // Отримуємо businessId з глобального scope
      const currentBusinessId = (window as any).__telegramOAuthBusinessId || businessId
      console.log('[TelegramOAuth] Using businessId:', currentBusinessId)
      
      try {
        if (!user || !user.id) {
          throw new Error('Некоректні дані від Telegram')
        }

        setLoading(true)
        console.log('[TelegramOAuth] Sending request to /api/auth/telegram-oauth')
        
        // Використовуємо новий API для автоматичної реєстрації/входу
        const response = await fetch('/api/auth/telegram-oauth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId: currentBusinessId || undefined, // Якщо є - прив'язуємо, якщо ні - створюємо новий
            telegramData: user
          })
        })
        
        console.log('[TelegramOAuth] Response status:', response.status)
        
        if (response.ok) {
          const data = await response.json()
          console.log('[TelegramOAuth] ✅ Success, action:', data.action, 'data:', data)
          
          setIsConnected(true)
          setUserData(data.user)
          onConnected(data)
          setShowWidget(false)
          
          // Якщо це автоматична реєстрація - зберігаємо бізнес в localStorage
          if (data.action === 'register' && data.business) {
            if (typeof window !== 'undefined') {
              setBusinessData(data.business, true)
              console.log('[TelegramOAuth] ✅ Business saved to localStorage')
            }
          }
          
          // Якщо це вхід - оновлюємо localStorage
          if (data.action === 'login' && data.business) {
            if (typeof window !== 'undefined') {
              setBusinessData(data.business, true)
              console.log('[TelegramOAuth] ✅ Business updated in localStorage')
            }
          }
          
          try {
            const toastModule = await import('@/components/ui/toast')
            const message = data.action === 'register' 
              ? 'Бізнес автоматично створено через Telegram!'
              : data.action === 'login'
              ? 'Вхід через Telegram успішний!'
              : 'Telegram підключено!'
            toastModule.toast({ title: 'Успішно!', description: message, type: 'success' })
          } catch (e) {
            console.error('Error showing success toast:', e)
          }
          
          await checkConnection()
          
          // Якщо це нова реєстрація - перенаправляємо на dashboard
          if (data.action === 'register' && typeof window !== 'undefined') {
            setTimeout(() => {
              window.location.href = '/dashboard'
            }, 1500)
          }
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Не вдалося підключити' }))
          const errorMessage = errorData.error || 'Не вдалося підключити'
          console.error('[TelegramOAuth] ❌ Error response:', errorData)
          setError(errorMessage)
          try {
            const toastModule = await import('@/components/ui/toast')
            toastModule.toast({ title: 'Помилка', description: errorMessage, type: 'error' })
          } catch (e) {
            console.error('Error showing error toast:', e)
          }
        }
      } catch (error: any) {
        console.error('[TelegramOAuth] ❌ Error connecting Telegram:', error)
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

    // Telegram Widget вимагає просте ім'я onTelegramAuth
    // Зберігаємо businessId в глобальному scope для доступу з callback
    ;(window as any).__telegramOAuthBusinessId = businessId
    ;(window as any).onTelegramAuth = authHandler
    
    console.log('[TelegramOAuth] ✅ Global function registered: onTelegramAuth')
    console.log('[TelegramOAuth] Function available:', typeof (window as any).onTelegramAuth)
    console.log('[TelegramOAuth] BusinessId stored in global:', (window as any).__telegramOAuthBusinessId)

    return () => {
      // Cleanup: видаляємо глобальну функцію тільки якщо це наш екземпляр
      if (typeof window !== 'undefined' && widgetIdRef.current === widgetId) {
        delete (window as any).onTelegramAuth
        delete (window as any).__telegramOAuthBusinessId
        console.log('[TelegramOAuth] Cleanup: removed function onTelegramAuth')
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
    
    console.log('[TelegramOAuth] Loading widget with:', { botName, businessId })
    
    // Перевіряємо, чи функція доступна перед завантаженням скрипта
    if (typeof (window as any).onTelegramAuth !== 'function') {
      console.error('[TelegramOAuth] ❌ Auth handler function not found! onTelegramAuth')
      setError('Помилка налаштування. Спробуйте оновити сторінку.')
      setLoading(false)
      setShowWidget(false)
      return
    }
    
    console.log('[TelegramOAuth] ✅ Auth handler function found and ready')

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
    // Telegram Widget вимагає просте ім'я onTelegramAuth
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    script.async = true
    
    console.log('[TelegramOAuth] Script attributes:', {
      'data-telegram-login': botName,
      'data-onauth': 'onTelegramAuth(user)',
      'data-size': 'large'
    })
    
    script.onerror = async () => {
      console.error('[TelegramOAuth] ❌ Script load error')
      setError('Не вдалося завантажити Telegram Widget. Переконайтеся, що домен налаштований в @BotFather.')
      setLoading(false)
      setShowWidget(false)
      try {
        const toastModule = await import('@/components/ui/toast')
        toastModule.toast({ 
          title: 'Помилка', 
          description: 'Не вдалося завантажити Telegram Widget. Перевірте налаштування домену в @BotFather.', 
          type: 'error' 
        })
      } catch (e) {
        console.error('Error showing toast:', e)
      }
    }
    
    script.onload = () => {
      console.log('[TelegramOAuth] ✅ Widget script loaded')
      setLoading(false)
      
      // Перевіряємо, чи iframe створено
      setTimeout(() => {
        const iframe = container.querySelector('iframe')
        if (iframe) {
          console.log('[TelegramOAuth] ✅ Telegram iframe created:', iframe.id)
        } else {
          console.warn('[TelegramOAuth] ⚠️ Telegram iframe not found')
        }
      }, 1000)
    }
    
    // Обробка помилок безпеки (CORS)
    window.addEventListener('error', (event) => {
      if (event.message && event.message.includes('Blocked a frame with origin')) {
        console.error('[TelegramOAuth] ❌ SecurityError detected:', event.message)
        setError('Помилка безпеки: домен не налаштований в @BotFather. Додайте xbase.online в Edit Domains.')
        setLoading(false)
        setShowWidget(false)
      }
    }, true)

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
  }, [showWidget, botName, businessId])

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
          <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
            ⚠️ {error}
          </p>
          {error.includes('домен') || error.includes('@BotFather') && (
            <div className="text-xs text-red-700 dark:text-red-300 space-y-1 mt-2">
              <p><strong>Як виправити:</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Відкрийте <a href="https://t.me/botfather" target="_blank" rel="noopener noreferrer" className="underline">@BotFather</a> в Telegram</li>
                <li>Виберіть вашого бота (@xbasesbot)</li>
                <li>Оберіть "Edit Bot" → "Edit Domains"</li>
                <li>Додайте домен: <code className="bg-red-100 dark:bg-red-900 px-1 rounded">xbase.online</code></li>
                <li>Оновіть сторінку та спробуйте знову</li>
              </ol>
            </div>
          )}
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

