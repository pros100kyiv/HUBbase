'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BotIcon, CheckIcon, XIcon } from '@/components/icons'
import { ModalPortal } from '@/components/ui/modal-portal'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'
import { getBusinessData, setBusinessData } from '@/lib/business-storage'
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
  const router = useRouter()
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [showBotNotConfiguredModal, setShowBotNotConfiguredModal] = useState(false)

  const openBotSettings = () => {
    setShowBotNotConfiguredModal(false)
    router.push('/dashboard/settings?tab=integrations')
  }

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
      } else if (data.code === 'BOT_NOT_CONFIGURED') {
        setShowBotNotConfiguredModal(true)
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
          'w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-[0.98] text-center',
          'bg-[#0088cc] hover:bg-[#0099dd] text-white shadow-md shadow-[#0088cc]/25'
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
      {showBotNotConfiguredModal && (
        <BotNotConfiguredModal
          onOpenSettings={openBotSettings}
          onClose={() => setShowBotNotConfiguredModal(false)}
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

function BotNotConfiguredModal({
  onOpenSettings,
  onClose,
}: {
  onOpenSettings: () => void
  onClose: () => void
}) {
  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bot-not-configured-title"
      >
        <div
          className="rounded-xl p-6 card-glass max-w-sm w-full shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="bot-not-configured-title" className="text-lg font-bold text-white mb-2">
            Telegram-бот не налаштований
          </h3>
          <p className="text-sm text-gray-300 mb-4">
            Швидке підключення недоступне. Ви можете підключити свого бота в налаштуваннях — додайте токен бота і налаштуйте його для отримання повідомлень.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-white/20 text-gray-300 hover:bg-white/10"
            >
              Закрити
            </button>
            <button
              onClick={onOpenSettings}
              className="flex-1 px-4 py-2 rounded-lg bg-[#0088cc] text-white font-semibold hover:bg-[#0088cc]/90"
            >
              Відкрити налаштування
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

const InstagramIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
)

const PLATFORM_META: Record<string, { icon: React.ReactNode; shortDesc: string }> = {
  telegram: { icon: <BotIcon className="w-5 h-5 text-[#0088cc]" />, shortDesc: 'Повідомлення від клієнтів' },
  instagram: { icon: <InstagramIcon />, shortDesc: 'Direct-листи' },
  whatsapp: { icon: <span className="text-lg">💬</span>, shortDesc: 'Скоро' },
  facebook: { icon: <span className="text-lg font-bold text-blue-400">f</span>, shortDesc: 'Скоро' },
  viber: { icon: <span className="text-lg font-bold text-purple-400">V</span>, shortDesc: 'Скоро' },
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
    const businessData = getBusinessData()
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
          setBusinessData(d.business)
        }
      }
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto min-w-0">
      <div className="grid grid-cols-dashboard-main lg:grid-cols-dashboard-main-lg gap-4 md:gap-6 min-w-0 w-full">
        <div className="space-y-4 md:space-y-6 min-w-0 overflow-visible">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
              Соціальні мережі
            </h1>
            <p className="text-sm text-gray-400 mt-1">Telegram, Instagram та листи клієнтів в одній панелі</p>
          </div>

          {/* Картки інтеграцій — однакова висота */}
          <div className="flex flex-wrap gap-3 md:gap-4 pl-1">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className={cn(
                  'rounded-2xl p-4 md:p-5 card-glass min-w-[150px] flex-1 max-w-[220px] flex flex-col min-h-[200px]',
                  'transition-all duration-200 hover:border-white/15 hover:shadow-lg hover:shadow-black/20',
                  integration.connected && 'border-2 border-green-500/50 shadow-[0_0_0_1px_rgba(34,197,94,0.4)]'
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0',
                    integration.id === 'telegram' && 'bg-[#0088cc]/25',
                    integration.id === 'instagram' && 'bg-gradient-to-br from-[#f09433]/30 to-[#e6683c]/30',
                    integration.id === 'whatsapp' && 'bg-emerald-500/25',
                    integration.id === 'facebook' && 'bg-blue-500/25',
                    integration.id === 'viber' && 'bg-purple-500/25',
                    !['telegram','instagram','whatsapp','facebook','viber'].includes(integration.id) && 'bg-white/10'
                  )}>
                    {integration.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-white block truncate">{integration.name}</span>
                    {integration.connected ? (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckIcon className="w-3.5 h-3.5 shrink-0" /> Підключено
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-500">Не підключено</span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mb-3">{integration.shortDesc}</p>
                <div className="mt-auto">
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
                        'block w-full px-3 py-2.5 rounded-xl text-[11px] font-semibold text-center transition-all duration-200',
                        integration.connected
                          ? 'border border-white/20 bg-white/5 text-gray-400 cursor-default'
                          : 'bg-gradient-to-r from-[#f09433] to-[#e6683c] text-white hover:shadow-lg hover:shadow-orange-500/20 hover:opacity-95'
                      )}
                      onClick={(e) => integration.connected && e.preventDefault()}
                    >
                      {integration.connected ? 'Підключено' : 'Підключити'}
                    </a>
                ) : (
                    <div className="w-full px-3 py-2.5 rounded-xl text-[11px] font-medium text-center border border-white/10 bg-white/[0.04] text-gray-500">
                      Скоро
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-sidebar-col space-y-4 md:space-y-6 flex flex-col min-w-0 w-full max-w-full overflow-hidden">
          {/* Tabs: Chat | Booking */}
          <div className="rounded-xl p-1.5 card-glass-elevated border border-white/10 flex w-full sm:w-fit sm:inline-flex gap-1">
            <button
              type="button"
              onClick={() => setTab('chat')}
              className={cn(
                'flex-1 sm:flex-none px-5 py-3 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2',
                activeTab === 'chat'
                  ? 'bg-white/20 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              )}
            >
              <span className="text-base" aria-hidden>💬</span> Чат
            </button>
            <button
              type="button"
              onClick={() => setTab('booking')}
              className={cn(
                'flex-1 sm:flex-none px-5 py-3 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2',
                activeTab === 'booking'
                  ? 'bg-white/20 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              )}
            >
              <span className="text-base" aria-hidden>📅</span> Запис
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

          <div className="rounded-xl p-4 md:p-5 card-glass border border-white/10">
            <h3 className="text-sm font-semibold text-white mb-3">Швидкі дії</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push('/dashboard/settings?tab=integrations')}
                className="px-4 py-2.5 rounded-xl text-xs font-medium border border-white/20 text-white hover:bg-white/10 hover:border-white/25 transition-colors"
              >
                ⚙️ Інтеграції
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/main')}
                className="px-4 py-2.5 rounded-xl text-xs font-medium border border-white/20 text-white hover:bg-white/10 hover:border-white/25 transition-colors"
              >
                🏠 Головна
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/appointments')}
                className="px-4 py-2.5 rounded-xl text-xs font-medium border border-white/20 text-white hover:bg-white/10 hover:border-white/25 transition-colors"
              >
                📆 Записи
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

