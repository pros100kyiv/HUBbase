'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BotIcon, PhoneIcon, CheckIcon, XIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { TelegramOAuth } from '@/components/admin/TelegramOAuth'
import { SocialMessagesCard } from '@/components/admin/SocialMessagesCard'

// Метадані платформ для іконок та опису (API повертає лише id, name, connected)
const PLATFORM_META: Record<string, { icon: React.ReactNode; description: string }> = {
  telegram: {
    icon: <BotIcon className="w-5 h-5" />,
    description: 'Отримуйте сповіщення та керуйте ботом',
  },
  instagram: {
    icon: <span className="text-xl">📷</span>,
    description: 'Скоро...',
  },
  whatsapp: {
    icon: <PhoneIcon className="w-5 h-5" />,
    description: 'Скоро...',
  },
  facebook: {
    icon: <span className="text-xl">f</span>,
    description: 'Скоро...',
  },
  viber: {
    icon: <span className="text-xl">V</span>,
    description: 'Скоро...',
  },
}

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
        const list = data.integrations || []
        setIntegrations(
          list.map((i: { id: string; name?: string; connected?: boolean }) => ({
            ...i,
            icon: PLATFORM_META[i.id]?.icon,
            description: PLATFORM_META[i.id]?.description ?? 'Скоро...',
            connected:
              i.id === 'telegram' ? (i.connected || !!business?.telegramChatId) : i.connected,
          }))
        )
      } else {
        // Якщо API не існує, створюємо базовий список
        setIntegrations([
          {
            id: 'telegram',
            name: 'Telegram',
            icon: <BotIcon className="w-5 h-5" />,
            color: 'from-blue-500 to-blue-600',
            connected: !!business?.telegramChatId,
            description: 'Отримуйте сповіщення та керуйте ботом'
          },
          {
            id: 'instagram',
            name: 'Instagram',
            icon: <span className="text-xl">📷</span>,
            color: 'from-pink-500 to-purple-600',
            connected: false,
            description: 'Скоро...'
          },
          {
            id: 'whatsapp',
            name: 'WhatsApp',
            icon: <PhoneIcon className="w-5 h-5" />,
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
      <div className="w-full max-w-7xl mx-auto min-w-0 overflow-hidden">
        <p className="text-gray-400">Завантаження...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto min-w-0 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-6 min-w-0 w-full">
        <div className="lg:col-span-3 space-y-3 md:space-y-6 min-w-0">
          {/* Header - same as Dashboard */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
              Соціальні мережі
            </h1>
          </div>

          {/* Telegram OAuth Section */}
          {business && (
            <div className="rounded-xl p-4 md:p-6 card-glass">
              <TelegramOAuth businessId={business.id} onConnected={handleTelegramConnected} />
            </div>
          )}

          {/* Integrations — дві картки в ряд, компактний вигляд */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className={cn(
                  'rounded-xl p-3 md:p-4 card-glass relative overflow-hidden',
                  integration.connected && 'ring-2 ring-white/30'
                )}
              >
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                      {integration.icon}
                    </div>
                    {integration.connected ? (
                      <div className="flex items-center gap-1 text-green-400">
                        <CheckIcon className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold">Підключено</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-gray-400">
                        <XIcon className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold">Не підключено</span>
                      </div>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">
                    {integration.name}
                  </h3>
                  <p className="text-[11px] text-gray-400 mb-3 line-clamp-2">
                    {integration.description}
                  </p>
                  {integration.id === 'telegram' ? (
                    <button
                      type="button"
                      onClick={() => router.push('/dashboard/settings?tab=telegram')}
                      className={cn(
                        'w-full px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-[0.98]',
                        integration.connected
                          ? 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      )}
                      style={!integration.connected ? { boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.25)' } : {}}
                    >
                      {integration.connected ? 'Налаштувати' : 'Підключити'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 bg-white/5 text-gray-500 cursor-not-allowed"
                    >
                      Скоро
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-1 space-y-3 md:space-y-6 flex flex-col min-w-0 w-full max-w-full overflow-hidden">
          {/* Повідомлення з соцмереж — дубль у кабінет, можливість відповісти */}
          {business?.id && (
            <SocialMessagesCard businessId={business.id} />
          )}
          <div className="rounded-xl p-4 md:p-6 card-glass min-w-0 overflow-hidden">
            <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4" style={{ letterSpacing: '-0.01em' }}>
              Швидкі дії
            </h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => router.push('/dashboard/settings?tab=telegram')}
                className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-colors active:scale-[0.98] text-left"
                style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.25)' }}
              >
                Налаштування Telegram
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/main')}
                className="w-full px-3 py-2 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-colors text-left"
              >
                Головна (повідомлення)
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/appointments')}
                className="w-full px-3 py-2 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-colors text-left"
              >
                Записи
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

