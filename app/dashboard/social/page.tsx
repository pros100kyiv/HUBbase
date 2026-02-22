'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BotIcon, CheckIcon, XIcon } from '@/components/icons'
import { ModalPortal } from '@/components/ui/modal-portal'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'
import { SocialMessagesCard } from '@/components/admin/SocialMessagesCard'
import { TelegramBookingsCard } from '@/components/admin/TelegramBookingsCard'

function TelegramQuickConnectButton({
  businessId,
  connected,
  onConnected,
  onDisconnected,
  onOpenSettings,
}: {
  businessId?: string
  connected: boolean
  onConnected: () => void
  onDisconnected?: () => void
  onOpenSettings?: () => void
}) {
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  const handleConnect = async () => {
    if (!businessId || connecting) return
    setShowConfirm(false)
    setConnecting(true)
    try {
      const res = await fetch('/api/telegram/quick-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({
          title: data.message || 'Telegram підключено!',
          description: data.inviteLink ? `Посилання: ${data.inviteLink}` : undefined,
          type: 'success',
          duration: 6000,
        })
        onConnected()
      } else {
        toast({ title: 'Помилка', description: data.error || 'Не вдалося підключити', type: 'error' })
      }
    } catch (e) {
      toast({ title: 'Помилка', description: 'Спробуйте пізніше', type: 'error' })
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!businessId || disconnecting) return
    setShowDisconnectConfirm(false)
    setDisconnecting(true)
    try {
      const res = await fetch('/api/telegram/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: data.message || 'Telegram відключено', type: 'success' })
        onDisconnected?.()
      } else {
        toast({ title: 'Помилка', description: data.error || 'Не вдалося відключити', type: 'error' })
      }
    } catch (e) {
      toast({ title: 'Помилка', description: 'Спробуйте пізніше', type: 'error' })
    } finally {
      setDisconnecting(false)
    }
  }

  if (connected) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="w-full px-3 py-1.5 rounded-lg text-xs font-medium border border-green-500/30 bg-green-500/10 text-green-400 text-center">
          Підключено
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setShowDisconnectConfirm(true)}
            disabled={disconnecting}
            className="flex-1 px-2 py-1 rounded text-[10px] font-medium border border-white/20 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-50"
          >
            {disconnecting ? '...' : 'Відключити'}
          </button>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex-1 px-2 py-1 rounded text-[10px] font-medium border border-white/20 text-gray-400 hover:text-white hover:bg-white/10"
            >
              Змінити
            </button>
          )}
        </div>
        {showDisconnectConfirm && (
          <ModalPortal>
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70"
              onClick={() => setShowDisconnectConfirm(false)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="disconnect-title"
            >
              <div
                className="rounded-xl p-6 card-glass max-w-sm w-full shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="disconnect-title" className="text-lg font-bold text-white mb-2">
                  Відключити Telegram?
                </h3>
                <p className="text-sm text-gray-300 mb-4">
                  Повідомлення більше не надходитимуть. Можна підключити знову в будь-який момент.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDisconnectConfirm(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-white/20 text-gray-300 hover:bg-white/10"
                  >
                    Скасувати
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold disabled:opacity-50"
                  >
                    {disconnecting ? '...' : 'Відключити'}
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}
      </div>
    )
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={connecting || !businessId}
        className={cn(
          'w-full px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-[0.98] text-center',
          'bg-[#0088cc] hover:bg-[#0088cc]/90 text-white'
        )}
      >
        {connecting ? 'Підключення...' : 'Підключити'}
      </button>
      {showConfirm && (
        <TelegramConfirmModal
          onConfirm={handleConnect}
          onCancel={() => setShowConfirm(false)}
          loading={connecting}
        />
      )}
    </>
  )
}

function TelegramConfirmModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70" onClick={onCancel}>
        <div
          className="rounded-xl p-6 card-glass max-w-sm w-full shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
        <h3 className="text-lg font-bold text-white mb-2">Підключити Telegram?</h3>
        <p className="text-sm text-gray-300 mb-4">
          Повідомлення з Telegram з&apos;являтимуться у цьому кабінеті. Діліться посиланням з клієнтами.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg border border-white/20 text-gray-300 hover:bg-white/10"
          >
            Скасувати
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-[#0088cc] text-white font-semibold hover:bg-[#0088cc]/90 disabled:opacity-50"
          >
            {loading ? '...' : 'Підключити'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

const PLATFORM_META: Record<string, { icon: React.ReactNode; shortDesc: string }> = {
  telegram: { icon: <BotIcon className="w-5 h-5" />, shortDesc: 'Повідомлення від клієнтів' },
  instagram: { icon: <span className="text-xl">📷</span>, shortDesc: 'Direct-листи' },
  whatsapp: { icon: <span className="text-xl">💬</span>, shortDesc: 'Скоро' },
  facebook: { icon: <span className="text-xl">f</span>, shortDesc: 'Скоро' },
  viber: { icon: <span className="text-xl">V</span>, shortDesc: 'Скоро' },
}

type SocialTab = 'chat' | 'booking'

export default function SocialPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [business, setBusiness] = useState<any>(null)
  const [integrations, setIntegrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<SocialTab>(() => (searchParams.get('tab') === 'booking' ? 'booking' : 'chat'))

  const bookingEnabled = useMemo(() => {
    try {
      const s = business?.telegramSettings
      if (s) return (JSON.parse(s) as { bookingEnabled?: boolean }).bookingEnabled
    } catch {}
    return false
  }, [business?.telegramSettings])

  useEffect(() => {
    const tab = searchParams.get('tab')
    const openChat = searchParams.get('openChat')
    if (openChat) setActiveTab('chat')
    else if (tab === 'booking' || tab === 'chat') setActiveTab(tab)
  }, [searchParams])

  const setTab = (t: SocialTab) => {
    setActiveTab(t)
    const u = new URL(window.location.href)
    u.searchParams.set('tab', t)
    router.replace(u.pathname + u.search, { scroll: false })
  }

  useEffect(() => {
    const instagram = searchParams.get('instagram')
    const err = searchParams.get('error')
    if (instagram === 'connected') {
      toast({ title: 'Instagram підключено', description: 'Листи з Direct тепер приходять у кабінет.', type: 'success', duration: 5000 })
      router.replace('/dashboard/social', { scroll: false })
    } else if (err) {
      const msg = err === 'no_instagram' ? 'Додайте Instagram до сторінки Facebook' : err === 'no_pages' ? 'Немає сторінок Facebook' : 'Не вдалося підключити'
      toast({ title: 'Помилка', description: msg, type: 'error', duration: 5000 })
      router.replace('/dashboard/social', { scroll: false })
    }
  }, [searchParams, router])

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
      const list: { id: string; name?: string; connected?: boolean }[] = response.ok
        ? ((await response.json()).integrations || [])
        : []
      if (list.length === 0) {
        list.push(
          { id: 'telegram', name: 'Telegram', connected: !!business?.telegramBotToken },
          { id: 'instagram', name: 'Instagram', connected: false },
          { id: 'whatsapp', name: 'WhatsApp', connected: false },
          { id: 'facebook', name: 'Facebook', connected: false },
          { id: 'viber', name: 'Viber', connected: false }
        )
      }
      setIntegrations(
        list.map((i) => ({
          ...i,
          icon: PLATFORM_META[i.id]?.icon,
          shortDesc: PLATFORM_META[i.id]?.shortDesc ?? '',
          connected: i.id === 'telegram' ? (i.connected || !!business?.telegramBotToken) : i.connected,
        }))
      )
    } catch {
      setIntegrations([
        { id: 'telegram', name: 'Telegram', icon: PLATFORM_META.telegram?.icon, shortDesc: 'Повідомлення', connected: !!business?.telegramBotToken },
        { id: 'instagram', name: 'Instagram', icon: PLATFORM_META.instagram?.icon, shortDesc: 'Direct', connected: false },
        { id: 'whatsapp', name: 'WhatsApp', icon: PLATFORM_META.whatsapp?.icon, shortDesc: 'Скоро', connected: false },
        { id: 'facebook', name: 'Facebook', icon: PLATFORM_META.facebook?.icon, shortDesc: 'Скоро', connected: false },
        { id: 'viber', name: 'Viber', icon: PLATFORM_META.viber?.icon, shortDesc: 'Скоро', connected: false },
      ])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto min-w-0 overflow-hidden">
        <p className="text-gray-400">Завантаження...</p>
      </div>
    )
  }

  const onTelegramConnected = async () => {
    await loadIntegrations()
    if (business?.id) {
      const r = await fetch(`/api/business/${business.id}`)
      if (r.ok) {
        const d = await r.json()
        if (d.business) {
          setBusiness(d.business)
          localStorage.setItem('business', JSON.stringify(d.business))
        }
      }
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto min-w-0 overflow-hidden">
      <div className="grid grid-cols-dashboard-main lg:grid-cols-dashboard-main-lg gap-3 md:gap-6 min-w-0 w-full">
        <div className="space-y-3 md:space-y-6 min-w-0 overflow-hidden">
          <h1 className="text-xl md:text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
            Соціальні мережі
          </h1>

          {/* Компактні картки: тільки Telegram і Instagram */}
          <div className="flex flex-wrap gap-2 md:gap-3">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className={cn(
                  'rounded-xl p-3 md:p-4 card-glass min-w-[140px] flex-1 max-w-[200px]',
                  integration.connected && 'ring-1 ring-green-500/50'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-white">
                    {integration.icon}
                  </div>
                  <span className="text-sm font-semibold text-white">{integration.name}</span>
                  {integration.connected ? (
                    <CheckIcon className="w-4 h-4 text-green-400 ml-auto" />
                  ) : (
                    <XIcon className="w-4 h-4 text-gray-500 ml-auto" />
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mb-2">{integration.shortDesc}</p>
                {integration.id === 'telegram' ? (
                  <TelegramQuickConnectButton
                    businessId={business?.id}
                    connected={integration.connected}
                    onConnected={onTelegramConnected}
                    onDisconnected={onTelegramConnected}
                    onOpenSettings={() => router.push('/dashboard/settings?tab=integrations')}
                  />
                ) : integration.id === 'instagram' ? (
                  <a
                    href={integration.connected ? '#' : `/api/instagram/oauth?businessId=${business?.id}`}
                    className={cn(
                      'block w-full px-2 py-1.5 rounded-lg text-[11px] font-semibold text-center transition-colors',
                      integration.connected
                        ? 'border border-white/20 bg-white/5 text-gray-400 cursor-default'
                        : 'bg-gradient-to-r from-[#f09433] to-[#e6683c] text-white hover:opacity-90'
                    )}
                    onClick={(e) => integration.connected && e.preventDefault()}
                  >
                    {integration.connected ? 'Підключено' : 'Підключити'}
                  </a>
                ) : (
                  <div className="w-full px-2 py-1.5 rounded-lg text-[11px] font-medium text-center border border-white/10 bg-white/5 text-gray-500">
                    Скоро
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-sidebar-col space-y-3 md:space-y-6 flex flex-col min-w-0 w-full max-w-full overflow-hidden">
          {/* Tabs: Chat | Booking */}
          <div className="rounded-xl p-1 card-glass flex w-full sm:w-fit sm:inline-flex">
            <button
              type="button"
              onClick={() => setTab('chat')}
              className={cn(
                'flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-semibold transition-all',
                activeTab === 'chat'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              💬 Чат
            </button>
            <button
              type="button"
              onClick={() => setTab('booking')}
              className={cn(
                'flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5',
                activeTab === 'booking'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              📅 Запис
            </button>
          </div>

          {activeTab === 'chat' && business?.id && (
            <SocialMessagesCard
              businessId={business.id}
              initialOpenChat={(() => {
                const open = searchParams.get('openChat')
                if (!open || !open.includes('::')) return null
                const [platform, externalChatId] = open.split('::')
                return platform && externalChatId ? { platform, externalChatId } : null
              })()}
            />
          )}
          {activeTab === 'booking' && business?.id && (
            <TelegramBookingsCard businessId={business.id} bookingEnabled={bookingEnabled} />
          )}

          <div className="rounded-xl p-4 card-glass">
            <h3 className="text-sm font-semibold text-white mb-2">Швидкі дії</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push('/dashboard/settings?tab=integrations')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/20 text-white hover:bg-white/10"
              >
                Інтеграції
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/main')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/20 text-white hover:bg-white/10"
              >
                Головна
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/appointments')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/20 text-white hover:bg-white/10"
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

