'use client'

import { useEffect, useState, useRef } from 'react'
import { BotIcon, CheckIcon, XIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'

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
  const scriptLoadedRef = useRef(false)

  useEffect(() => {
    checkConnection()
    fetchBotName()
  }, [businessId])

  const fetchBotName = async () => {
    try {
      const response = await fetch(`/api/telegram/bot-name?businessId=${businessId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.botName) {
          setBotName(data.botName)
        } else {
          setError('Telegram бот не налаштований. Будь ласка, налаштуйте бота в налаштуваннях.')
        }
      }
    } catch (error) {
      console.error('Error fetching bot name:', error)
      setError('Не вдалося завантажити налаштування бота')
    }
  }

  const checkConnection = async () => {
    try {
      const response = await fetch(`/api/telegram/connection?businessId=${businessId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.connected) {
          setIsConnected(true)
          setUserData(data.user)
        }
      }
    } catch (error) {
      console.error('Error checking connection:', error)
    }
  }

  const handleTelegramAuth = () => {
    if (!botName) {
      toast({ 
        title: 'Помилка', 
        description: 'Telegram бот не налаштований. Будь ласка, налаштуйте бота спочатку.', 
        type: 'error' 
      })
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      // Очищаємо попередній контейнер
      const container = document.getElementById('telegram-login-container')
      if (container) {
        container.innerHTML = ''
      }

      // Видаляємо попередню глобальну функцію, якщо вона існує
      if ((window as any).onTelegramAuth) {
        delete (window as any).onTelegramAuth
      }
      
      // Глобальна функція для обробки авторизації
      ;(window as any).onTelegramAuth = async (user: any) => {
        try {
          if (!user || !user.id) {
            throw new Error('Некоректні дані від Telegram')
          }

          const response = await fetch('/api/telegram/oauth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              businessId,
              telegramData: user
            })
          })
          
          if (response.ok) {
            const data = await response.json()
            setIsConnected(true)
            setUserData(data.user || data.telegramUser)
            onConnected(data)
            toast({ title: 'Telegram підключено!', type: 'success' })
            // Оновлюємо статус після успішного підключення
            await checkConnection()
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Не вдалося підключити' }))
            const errorMessage = errorData.error || 'Не вдалося підключити'
            setError(errorMessage)
            toast({ title: 'Помилка', description: errorMessage, type: 'error' })
          }
        } catch (error: any) {
          console.error('Error connecting Telegram:', error)
          const errorMessage = error.message || 'Помилка підключення'
          setError(errorMessage)
          toast({ title: 'Помилка', description: errorMessage, type: 'error' })
        } finally {
          setLoading(false)
        }
      }
      
      // Створюємо Telegram Login Widget
      const script = document.createElement('script')
      script.src = 'https://telegram.org/js/telegram-widget.js?22'
      script.setAttribute('data-telegram-login', botName)
      script.setAttribute('data-size', 'large')
      script.setAttribute('data-onauth', 'onTelegramAuth(user)')
      script.setAttribute('data-request-access', 'write')
      script.async = true
      
      script.onerror = () => {
        setError('Не вдалося завантажити Telegram Widget')
        setLoading(false)
        toast({ title: 'Помилка', description: 'Не вдалося завантажити Telegram Widget', type: 'error' })
      }
      
      // Додаємо скрипт
      if (container) {
        container.appendChild(script)
        scriptLoadedRef.current = true
      } else {
        setError('Контейнер для Telegram Widget не знайдено')
        setLoading(false)
      }
    } catch (error: any) {
      console.error('Error setting up Telegram auth:', error)
      setError(error.message || 'Помилка налаштування')
      setLoading(false)
      toast({ title: 'Помилка', description: 'Помилка налаштування Telegram авторизації', type: 'error' })
    }
  }

  const handleDisconnect = async () => {
    try {
      const response = await fetch('/api/telegram/oauth', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId })
      })
      
      if (response.ok) {
        setIsConnected(false)
        setUserData(null)
        toast({ title: 'Telegram відключено', type: 'success' })
      }
    } catch (error) {
      console.error('Error disconnecting:', error)
      toast({ title: 'Помилка', description: 'Не вдалося відключити', type: 'error' })
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
          <div id="telegram-login-container" className="flex justify-center min-h-[50px]">
            {!loading && botName && (
              <Button
                onClick={handleTelegramAuth}
                className="w-full bg-gradient-to-r from-candy-blue to-candy-purple text-white"
                disabled={!botName}
              >
                <BotIcon className="w-4 h-4 mr-2" />
                Підключити Telegram
              </Button>
            )}
            {loading && (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-candy-purple"></div>
                <p className="text-xs text-gray-500 mt-2">Підключення...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

