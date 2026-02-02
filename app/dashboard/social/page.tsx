'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BotIcon, PhoneIcon, CheckIcon, XIcon, ShareIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { TelegramOAuth } from '@/components/admin/TelegramOAuth'

export default function SocialPage() {
  const router = useRouter()
  const [business, setBusiness] = useState<any>(null)
  const [integrations, setIntegrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const businessData = localStorage.getItem('business')
    if (!businessData) {
      router.push('/login')
      return
    }
    try {
      const parsed = JSON.parse(businessData)
      setBusiness(parsed)
    } catch {
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    if (business?.id) {
      loadIntegrations()
    }
  }, [business])

  const loadIntegrations = async () => {
    try {
      const response = await fetch(`/api/social/integrations?businessId=${business.id}`)
      if (response.ok) {
        const data = await response.json()
        setIntegrations(data.integrations || [])
      } else {
        // Якщо API не існує, створюємо базовий список
        setIntegrations([
          {
            id: 'telegram',
            name: 'Telegram',
            icon: <BotIcon className="w-6 h-6" />,
            color: 'from-blue-500 to-blue-600',
            connected: !!business?.telegramChatId,
            description: 'Отримуйте сповіщення та керуйте ботом'
          },
          {
            id: 'instagram',
            name: 'Instagram',
            icon: <span className="text-2xl">📷</span>,
            color: 'from-pink-500 to-purple-600',
            connected: false,
            description: 'Скоро...'
          },
          {
            id: 'whatsapp',
            name: 'WhatsApp',
            icon: <PhoneIcon className="w-6 h-6" />,
            color: 'from-green-500 to-green-600',
            connected: false,
            description: 'Скоро...'
          }
        ])
      }
    } catch (error) {
      console.error('Error loading integrations:', error)
      // Базовий список якщо помилка
      setIntegrations([
        {
          id: 'telegram',
          name: 'Telegram',
          icon: <BotIcon className="w-6 h-6" />,
          color: 'from-blue-500 to-blue-600',
          connected: !!business?.telegramChatId,
          description: 'Отримуйте сповіщення та керуйте ботом'
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleTelegramConnected = (data: any) => {
    // Оновлюємо локальні дані
    const businessData = localStorage.getItem('business')
    if (businessData) {
      const parsed = JSON.parse(businessData)
      parsed.telegramChatId = data.user?.telegramId?.toString()
      localStorage.setItem('business', JSON.stringify(parsed))
      setBusiness(parsed)
    }
    loadIntegrations()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-gray-500">Завантаження...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-2">
          Соціальні мережі
        </h1>
        <p className="text-base text-gray-600 dark:text-gray-400">
          Підключіть соціальні мережі для автоматизації та розсилок
        </p>
      </div>

      {/* Telegram OAuth Section */}
      {business && (
        <div className="mb-6">
          <TelegramOAuth businessId={business.id} onConnected={handleTelegramConnected} />
        </div>
      )}

      {/* Other Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className={cn(
              "card-candy p-6 relative overflow-hidden",
              integration.connected && "ring-2 ring-green-500"
            )}
          >
            <div className={cn(
              "absolute top-0 right-0 w-20 h-20 rounded-full -mr-10 -mt-10 bg-gradient-to-br",
              integration.color,
              "opacity-10"
            )} />
            
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className={cn(
                  "w-12 h-12 rounded-candy-sm bg-gradient-to-br flex items-center justify-center text-white",
                  integration.color
                )}>
                  {integration.icon}
                </div>
                {integration.connected ? (
                  <div className="flex items-center gap-1 text-green-500">
                    <CheckIcon className="w-4 h-4" />
                    <span className="text-xs font-bold">Підключено</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-gray-400">
                    <XIcon className="w-4 h-4" />
                    <span className="text-xs font-bold">Не підключено</span>
                  </div>
                )}
              </div>

              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">
                {integration.name}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                {integration.description}
              </p>

              {integration.id === 'telegram' ? (
                <button
                  onClick={() => router.push('/dashboard/settings?tab=telegram')}
                  className={cn(
                    "w-full px-4 py-2 rounded-candy-xs font-bold text-sm transition-all",
                    integration.connected
                      ? "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      : "bg-gradient-to-r from-candy-blue to-candy-purple text-white shadow-soft-lg hover:shadow-soft-xl"
                  )}
                >
                  {integration.connected ? 'Налаштувати' : 'Підключити'}
                </button>
              ) : (
                <button
                  disabled
                  className="w-full px-4 py-2 rounded-candy-xs font-bold text-sm bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                >
                  Скоро
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

