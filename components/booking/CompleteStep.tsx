'use client'

import { useBooking } from '@/contexts/BookingContext'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { formatInTimeZone } from 'date-fns-tz'
import { useEffect, useMemo, useState } from 'react'
import { toast } from '@/components/ui/toast'

interface CompleteStepProps {
  businessName?: string
  businessLocation?: string | null
  /** Business booking timezone (from business settings). */
  timeZone?: string
  /** Slug for fetching Telegram invite link. */
  businessSlug?: string | null
}

function formatStatusLabel(status?: string | null): { label: string; tone: 'neutral' | 'success' | 'warning' | 'error' } {
  const s = (status || '').toLowerCase()
  if (!s) return { label: 'Статус невідомий', tone: 'neutral' }
  if (s === 'pending') return { label: 'Очікує підтвердження', tone: 'warning' }
  if (s === 'confirmed') return { label: 'Підтверджено', tone: 'success' }
  if (s === 'done' || s === 'completed') return { label: 'Виконано', tone: 'success' }
  if (s === 'cancelled') return { label: 'Скасовано', tone: 'error' }
  // UA / other legacy statuses
  if (s.includes('очіку')) return { label: 'Очікує підтвердження', tone: 'warning' }
  if (s.includes('підтвер')) return { label: 'Підтверджено', tone: 'success' }
  if (s.includes('скас')) return { label: 'Скасовано', tone: 'error' }
  if (s.includes('викон')) return { label: 'Виконано', tone: 'success' }
  return { label: status || 'Статус', tone: 'neutral' }
}

const TelegramIcon = () => (
  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.192l-1.87 8.803c-.14.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.053 5.56-5.022c.24-.213-.054-.334-.373-.12l-6.87 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
  </svg>
)

export function CompleteStep({ businessName, businessLocation, timeZone, businessSlug }: CompleteStepProps) {
  const { state, reset, setStep } = useBooking()
  const [pushBusy, setPushBusy] = useState(false)
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null)
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null)
  const [pushConfigChecked, setPushConfigChecked] = useState(false)
  const [tgInviteLink, setTgInviteLink] = useState<string | null>(null)

  useEffect(() => {
    if (!businessSlug?.trim()) return
    const token = state.confirmation?.manageToken
    const url =
      token && token.length >= 20
        ? `/api/booking/telegram-invite?slug=${encodeURIComponent(businessSlug)}&manageToken=${encodeURIComponent(token)}`
        : `/api/booking/telegram-invite?slug=${encodeURIComponent(businessSlug)}`
    fetch(url)
      .then((r) => r.json())
      .then((d) => (d?.hasTelegram && d?.inviteLink ? setTgInviteLink(d.inviteLink) : null))
      .catch(() => {})
  }, [businessSlug, state.confirmation?.manageToken])

  const isPriceAfterProcedure =
    state.bookingWithoutService || (state.customServiceName && state.customServiceName.trim().length > 0)
  const totalPrice = state.selectedServices.reduce((sum, s) => sum + s.price, 0)

  const servicesLabel = isPriceAfterProcedure
    ? (state.customServiceName?.trim() ? state.customServiceName.trim() : 'Без послуги — вартість після процедури')
    : (state.selectedServices.length ? state.selectedServices.map((s) => s.name).join(', ') : '—')

  const effectiveTimeZone =
    timeZone ||
    (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '') ||
    'Europe/Kyiv'

  const dateLabel = (() => {
    const startIso = state.confirmation?.startTime
    const endIso = state.confirmation?.endTime
    if (startIso) {
      const start = new Date(startIso)
      if (Number.isFinite(start.getTime())) {
        const day = formatInTimeZone(start, effectiveTimeZone, 'd MMMM yyyy', { locale: uk })
        const startHm = formatInTimeZone(start, effectiveTimeZone, 'HH:mm', { locale: uk })
        if (endIso) {
          const end = new Date(endIso)
          if (Number.isFinite(end.getTime())) {
            const endHm = formatInTimeZone(end, effectiveTimeZone, 'HH:mm', { locale: uk })
            return `${day}, ${startHm}–${endHm}`
          }
        }
        return `${day}, ${startHm}`
      }
    }
    if (state.selectedDate && state.selectedTime) {
      return `${format(state.selectedDate, 'd MMMM yyyy', { locale: uk })}, ${state.selectedTime}`
    }
    return '—'
  })()

  const statusInfo = formatStatusLabel(state.confirmation?.status)
  const manageUrl = state.confirmation?.manageUrl || null

  const canUsePush = useMemo(() => {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
  }, [])

  // Fetch VAPID public key from server. Avoid showing any global "error" toasts on load.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!canUsePush) {
        setPushConfigChecked(true)
        return
      }
      try {
        const res = await fetch('/api/push/config', { cache: 'no-store' })
        const data = await res.json().catch(() => ({} as any))
        const key = typeof data?.publicKey === 'string' ? data.publicKey : null
        if (!cancelled) setVapidPublicKey(key && key.trim() ? key.trim() : null)
      } catch {
        if (!cancelled) setVapidPublicKey(null)
      } finally {
        if (!cancelled) setPushConfigChecked(true)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [canUsePush])

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
    return outputArray
  }

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | null = null
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), ms)
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  const getPushRegistration = async (): Promise<ServiceWorkerRegistration> => {
    // `navigator.serviceWorker.ready` waits for an active SW *controlling this page*.
    // On first install (or on some iOS/PWA edge cases) that can take a reload, so we
    // instead work with the registration directly and only wait for activation.
    const existing = await navigator.serviceWorker.getRegistration().catch(() => null)
    const reg =
      existing ||
      (await navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => {
        throw new Error(e instanceof Error ? e.message : 'Не вдалося зареєструвати Service Worker')
      }))

    if (reg.active) return reg

    // Wait until the installing/waiting worker becomes activated.
    await withTimeout(
      new Promise<void>((resolve) => {
        const tryResolve = () => {
          if (reg.active) resolve()
        }

        tryResolve()

        const onStateChange = () => tryResolve()
        const attach = (w?: ServiceWorker | null) => {
          if (!w) return
          w.addEventListener('statechange', onStateChange)
        }

        attach(reg.installing)
        attach(reg.waiting)

        reg.addEventListener('updatefound', () => attach(reg.installing))
      }),
      20000,
      'Service Worker не активувався (timeout)'
    )

    return reg
  }

  const handleEnablePush = async () => {
    if (pushBusy) return

    const token = state.confirmation?.manageToken
    if (!token) {
      toast({ title: 'Помилка', description: 'Немає токена доступу до запису. Оновіть сторінку та спробуйте ще раз.', type: 'error' })
      return
    }
    if (!canUsePush) {
      toast({ title: 'Непідтримується', description: 'Push-нагадування недоступні в цьому браузері/режимі.', type: 'info' })
      return
    }

    setPushBusy(true)
    try {
      // Re-check config right before enabling to avoid stale UI.
      let publicKey = vapidPublicKey
      if (!publicKey) {
        try {
          const res = await withTimeout(fetch('/api/push/config', { cache: 'no-store' }), 8000, 'Сервер push не відповідає (timeout)')
          const data = await res.json().catch(() => ({} as any))
          publicKey = typeof data?.publicKey === 'string' ? data.publicKey.trim() : null
        } catch {
          publicKey = null
        }
        setVapidPublicKey(publicKey)
      }
      if (!publicKey) {
        // No toast here: show inline state instead of "hanging" messages.
        setPushEnabled(false)
        return
      }

      if (typeof Notification === 'undefined' || typeof Notification.requestPermission !== 'function') {
        throw new Error('Сповіщення не підтримуються у цьому браузері/режимі.')
      }

      const permission = await withTimeout(Notification.requestPermission(), 20000, 'Очікуємо дозвіл на сповіщення (timeout)')
      if (permission !== 'granted') {
        setPushEnabled(false)
        toast({ title: 'Доступ заборонено', description: 'Щоб отримувати нагадування, дозвольте сповіщення в браузері.', type: 'info' })
        return
      }

      const reg = await getPushRegistration()

      let applicationServerKey: Uint8Array
      try {
        applicationServerKey = urlBase64ToUint8Array(publicKey)
      } catch (e) {
        throw new Error('Невірний формат ключа push. Зверніться до адміністратора сайту.')
      }

      let sub = await withTimeout(reg.pushManager.getSubscription(), 10000, 'Не вдалося перевірити підписку (timeout)')
      if (!sub) {
        sub = await withTimeout(
          reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          }),
          20000,
          'Не вдалося створити підписку Push (timeout)'
        )
      }

      const bufToBase64 = (buf: ArrayBuffer | null | undefined) => {
        if (!buf || buf.byteLength === 0) return ''
        const arr = new Uint8Array(buf)
        let binary = ''
        for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i])
        return btoa(binary)
      }
      const subscriptionJson =
        typeof sub.toJSON === 'function'
          ? sub.toJSON()
          : {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.getKey?.('p256dh') ? bufToBase64(sub.getKey('p256dh')) : undefined,
                auth: sub.getKey?.('auth') ? bufToBase64(sub.getKey('auth')) : undefined,
              },
            }
      const ac = new AbortController()
      const reqTimeout = setTimeout(() => ac.abort(), 15000)
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, subscription: subscriptionJson }),
        signal: ac.signal,
      }).finally(() => clearTimeout(reqTimeout))
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Не вдалося увімкнути push')
      }
      setPushEnabled(true)
      toast({ title: 'Нагадування увімкнено', description: 'Тепер можна отримувати push-нагадування по цьому запису.', type: 'success' })
    } catch (e) {
      console.error(e)
      setPushEnabled(false)
      const msg =
        e instanceof Error && e.name === 'AbortError'
          ? 'Сервер довго не відповідає. Спробуйте ще раз.'
          : e instanceof Error
            ? e.message
            : 'Не вдалося увімкнути push'
      toast({ title: 'Помилка', description: msg, type: 'error' })
    } finally {
      setPushBusy(false)
    }
  }

  const handleNewBooking = () => {
    reset()
    setStep(0)
  }

  return (
    <div className="min-h-screen py-4 sm:py-6 px-3 md:px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 text-center text-foreground" style={{ letterSpacing: '-0.02em' }}>
          Ви записані
        </h2>

        <div className="rounded-xl p-4 mb-4 card-glass border border-black/10 dark:border-white/10">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">Статус:</span>
              <span
                className={cn(
                  'text-xs font-semibold px-2 py-1 rounded-full border whitespace-nowrap',
                  statusInfo.tone === 'success' && 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300',
                  statusInfo.tone === 'warning' && 'bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-200',
                  statusInfo.tone === 'error' && 'bg-rose-500/10 border-rose-500/25 text-rose-800 dark:text-rose-200',
                  statusInfo.tone === 'neutral' && 'bg-black/[0.03] dark:bg-white/5 border-black/10 dark:border-white/10 text-gray-700 dark:text-gray-300'
                )}
                title={state.confirmation?.status || undefined}
              >
                {statusInfo.label}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">Куди:</span>
              <span className="font-medium text-foreground dark:text-white text-right">
                {businessName || '—'}
              </span>
            </div>
            {businessLocation && businessLocation.trim() && (
              <div className="flex justify-between gap-3">
                <span className="text-gray-600 dark:text-gray-400">Адреса:</span>
                <span className="font-medium text-foreground dark:text-white text-right max-w-[65%]">
                  {businessLocation.trim()}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">Спеціаліст:</span>
              <span className="font-medium text-foreground dark:text-white text-right">
                {state.selectedMaster?.name || '—'}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">Коли:</span>
              <span className="font-medium text-foreground dark:text-white text-right">{dateLabel}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">Що будете робити:</span>
              <span className="font-medium text-foreground dark:text-white text-right max-w-[65%]">
                {servicesLabel}
              </span>
            </div>
            <div className="flex justify-between gap-3 pt-2 border-t border-black/10 dark:border-white/10">
              <span className="text-gray-600 dark:text-gray-400">Сума:</span>
              <span className="text-lg font-bold text-purple-500">
                {isPriceAfterProcedure ? 'Узгоджується' : `${Math.round(totalPrice)} ₴`}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl p-4 mb-4 card-glass border border-black/10 dark:border-white/10">
          <p className="text-sm font-semibold text-foreground mb-2">Нагадування</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Push-нагадування працюють на телефоні та комп’ютері. На iPhone: спочатку додайте сторінку на початок екрану (⋮ → «На екран Домівки»), потім натисніть кнопку нижче.
          </p>
          <button
            type="button"
            onClick={handleEnablePush}
            disabled={pushBusy || pushEnabled === true || (pushConfigChecked && !vapidPublicKey)}
            className={cn(
              'w-full min-h-[48px] py-3 rounded-xl text-sm font-semibold transition-colors',
              pushEnabled === true
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-black/[0.06] dark:bg-white/10 border border-black/10 dark:border-white/15 text-foreground dark:text-white hover:bg-black/[0.08] dark:hover:bg-white/15',
              (pushBusy || pushEnabled === true || (pushConfigChecked && !vapidPublicKey)) && 'opacity-80'
            )}
            aria-disabled={pushBusy || pushEnabled === true}
            title={
              pushEnabled === true
                ? 'Увімкнено'
                : pushConfigChecked && !vapidPublicKey
                  ? 'Push не налаштовано на сервері'
                  : 'Увімкнути push-нагадування'
            }
          >
            {pushEnabled === true
              ? 'Нагадування увімкнено'
              : pushBusy
                ? 'Увімкнення...'
                : pushConfigChecked && !vapidPublicKey
                  ? 'Push тимчасово недоступний'
                  : 'Отримати push-нагадування'}
          </button>
          {pushConfigChecked && !vapidPublicKey && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
              Push не налаштовано (немає VAPID ключів на сервері). Додайте env змінні як у `docs/push-env.example.txt`.
            </p>
          )}
        </div>

        {tgInviteLink && (
          <div className="rounded-xl p-4 mb-4 card-glass border border-[#0088cc]/30 bg-[#0088cc]/5">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <TelegramIcon />
              Сповіщення в Telegram
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              {state.confirmation?.manageToken
                ? 'Натисніть — перейдете в бот і одразу побачите підтвердження вашого запису. Там можна отримувати нагадування, перенести чи скасувати візит.'
                : 'Підключіть бота — отримуйте підтвердження, нагадування про візит та можливість перенести або скасувати запис.'}
            </p>
            <a
              href={tgInviteLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[48px] py-3 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-sm font-semibold transition-colors active:scale-[0.98] inline-flex items-center justify-center gap-2"
            >
              <TelegramIcon />
              {state.confirmation?.manageToken ? 'Перейти в бот — побачити запис' : 'Відкрити Telegram-бота'}
            </a>
          </div>
        )}

        {manageUrl && (
          <div className="rounded-xl p-4 mb-4 card-glass border border-black/10 dark:border-white/10">
            <p className="text-sm font-semibold text-foreground mb-2">Керування записом</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              За цим посиланням можна попросити перенести або скасувати запис (потрібне підтвердження майстра).
            </p>
            <div className="flex gap-2">
              <a
                href={manageUrl}
                className="flex-1 min-h-[48px] py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-colors active:scale-[0.98] inline-flex items-center justify-center"
              >
                Відкрити керування записом
              </a>
              <button
                type="button"
                onClick={() => {
                  const full = typeof window !== 'undefined' ? `${window.location.origin}${manageUrl.startsWith('/') ? '' : '/'}${manageUrl}` : manageUrl
                  navigator.clipboard?.writeText(full).then(
                    () => toast({ title: 'Посилання скопійовано', type: 'success', duration: 2000 }),
                    () => {}
                  )
                }}
                className="min-h-[48px] px-4 py-3 rounded-xl border border-black/10 dark:border-white/20 bg-black/[0.04] dark:bg-white/10 text-foreground dark:text-white text-sm font-medium hover:bg-black/[0.06] dark:hover:bg-white/15 transition-colors"
                title="Копіювати посилання"
              >
                📋
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleNewBooking}
            className="flex-1 min-h-[48px] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors active:scale-[0.98]"
          >
            Створити ще один запис
          </button>
          <button
            type="button"
            onClick={() => { if (typeof window !== 'undefined') window.location.href = '/' }}
            className="flex-1 min-h-[48px] py-2.5 rounded-xl border border-black/10 dark:border-white/20 bg-black/[0.04] dark:bg-white/10 text-foreground dark:text-white text-sm font-medium hover:bg-black/[0.06] dark:hover:bg-white/20 transition-colors active:scale-[0.98]"
          >
            На головну
          </button>
        </div>
      </div>
    </div>
  )
}

