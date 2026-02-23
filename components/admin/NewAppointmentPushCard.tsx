'use client'

import { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'

interface NewAppointmentPushCardProps {
  businessId: string
  className?: string
}

export function NewAppointmentPushCard({ businessId, className }: NewAppointmentPushCardProps) {
  const [pushBusy, setPushBusy] = useState(false)
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null)
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null)
  const [pushConfigChecked, setPushConfigChecked] = useState(false)

  const canUsePush = useMemo(() => {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!canUsePush) {
        setPushConfigChecked(true)
        return
      }
      try {
        const res = await fetch('/api/push/config', { cache: 'no-store' })
        const data = await res.json().catch(() => ({} as Record<string, unknown>))
        const key = typeof data?.publicKey === 'string' ? data.publicKey : null
        if (!cancelled) setVapidPublicKey(key?.trim() ?? null)
      } catch {
        if (!cancelled) setVapidPublicKey(null)
      } finally {
        if (!cancelled) setPushConfigChecked(true)
      }
    }
    run()
    return () => { cancelled = true }
  }, [canUsePush])

  // Перевірка існуючої підписки при завантаженні — щоб не скидати стан після оновлення сторінки
  useEffect(() => {
    let cancelled = false
    const checkExistingSubscription = async () => {
      if (!canUsePush) return
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (!cancelled && sub) setPushEnabled(true)
      } catch {
        // Ігноруємо — push опціональний
      }
    }
    checkExistingSubscription()
    return () => { cancelled = true }
  }, [canUsePush])

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
    return outputArray
  }

  const handleEnable = async () => {
    if (pushBusy || !canUsePush || !vapidPublicKey) return

    setPushBusy(true)
    try {
      if (typeof Notification === 'undefined' || typeof Notification.requestPermission !== 'function') {
        toast({ title: 'Push не підтримуються', description: 'Спробуйте інший браузер.', type: 'info' })
        return
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        toast({ title: 'Доступ заборонено', description: 'Дозвольте сповіщення в налаштуваннях браузера.', type: 'info' })
        return
      }

      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
      }

      const subscriptionJson = typeof sub.toJSON === 'function'
        ? sub.toJSON()
        : { endpoint: sub.endpoint, keys: sub.getKey ? { p256dh: sub.getKey('p256dh'), auth: sub.getKey('auth') } : {} }

      const res = await fetch('/api/push/subscribe-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, subscription: subscriptionJson }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok) {
        setPushEnabled(true)
        toast({ title: 'Push увімкнено', description: 'Ви отримуватимете сповіщення про нові записи.', type: 'success' })
      } else {
        toast({ title: 'Помилка', description: (data as { error?: string })?.error || 'Не вдалося увімкнути', type: 'error' })
      }
    } catch (e) {
      console.error('Push enable error:', e)
      toast({ title: 'Помилка', description: e instanceof Error ? e.message : 'Не вдалося увімкнути push', type: 'error' })
    } finally {
      setPushBusy(false)
    }
  }

  if (!canUsePush) return null

  return (
    <div className={cn('rounded-xl p-4 border border-white/10 bg-white/[0.04]', className)}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Push про нові записи</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Отримуйте сповіщення на телефон чи компʼютер, коли клієнт запишеться онлайн (навіть якщо вкладка закрита).
          </p>
          <button
            type="button"
            onClick={handleEnable}
            disabled={pushBusy || pushEnabled === true || (pushConfigChecked && !vapidPublicKey)}
            className={cn(
              'mt-3 w-full min-h-[44px] py-2.5 rounded-xl text-sm font-semibold transition-colors touch-target',
              pushEnabled === true
                ? 'bg-emerald-600/80 text-white cursor-default'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/20',
              (pushBusy || (pushConfigChecked && !vapidPublicKey)) && 'opacity-70'
            )}
          >
            {pushEnabled === true
              ? '✓ Push увімкнено'
              : pushBusy
                ? 'Увімкнення...'
                : pushConfigChecked && !vapidPublicKey
                  ? 'Push тимчасово недоступний'
                  : 'Увімкнути push'}
          </button>
        </div>
      </div>
    </div>
  )
}
