'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface TelegramBooking {
  id: string
  clientName: string
  clientPhone: string
  startTime: string
  endTime: string
  status: string
  masterName?: string
  source?: string | null
}

interface TelegramBookingsCardProps {
  businessId: string
  bookingEnabled?: boolean
}

export function TelegramBookingsCard({ businessId, bookingEnabled }: TelegramBookingsCardProps) {
  const router = useRouter()
  const [bookings, setBookings] = useState<TelegramBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, pending: 0, thisWeek: 0 })

  useEffect(() => {
    if (!businessId) return
    const load = async () => {
      setLoading(true)
      try {
        const aptRes = await fetch(
          `/api/appointments?businessId=${businessId}&source=telegram&startDate=${format(new Date(), 'yyyy-MM-dd')}&endDate=${format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}`
        )
        const aptList = aptRes.ok ? await aptRes.json() : []
        const withMaster = (aptList || []).map((a: TelegramBooking & { master?: { name: string } }) => ({
          ...a,
          masterName: a.master?.name ?? '—',
        }))
        setBookings(withMaster)

        const now = new Date()
        const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        const tgOnly = (aptList || []).filter((a: { source?: string }) => a.source === 'telegram')
        setStats({
          total: tgOnly.length,
          pending: tgOnly.filter((a: { status: string }) => a.status === 'Pending' || a.status === 'Очікує').length,
          thisWeek: tgOnly.filter((a: { startTime: string }) => {
            const d = new Date(a.startTime)
            return d >= now && d <= weekEnd
          }).length,
        })
      } catch {
        setBookings([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [businessId])

  const pendingBookings = bookings.filter((b) => b.status === 'Pending' || b.status === 'Очікує')

  return (
    <div className="rounded-2xl p-5 md:p-6 card-glass min-w-0 w-full overflow-hidden border border-white/10 transition-all duration-200 hover:border-white/15">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-[#0088cc]/25 flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-[#0088cc]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.192l-1.87 8.803c-.14.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.053 5.56-5.022c.24-.213-.054-.334-.373-.12l-6.87 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Записи через бота</h3>
          <p className="text-xs text-gray-400">Клієнти записуються кнопками в Telegram</p>
        </div>
      </div>

      {!bookingEnabled && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
          Запис через бота вимкнено. Увімкніть в Налаштування → Інтеграції → Telegram.
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-400 text-sm">Завантаження…</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="rounded-xl p-3.5 bg-white/5 border border-white/10 text-center transition-colors hover:bg-white/[0.07]">
              <div className="text-xl font-bold text-white">{stats.total}</div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">всього</div>
            </div>
            <div className="rounded-xl p-3.5 bg-amber-500/10 border border-amber-500/20 text-center transition-colors hover:bg-amber-500/15">
              <div className="text-xl font-bold text-amber-300">{stats.pending}</div>
              <div className="text-[10px] text-amber-200/70 uppercase tracking-wider mt-0.5">очікують</div>
            </div>
            <div className="rounded-xl p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-center transition-colors hover:bg-emerald-500/15">
              <div className="text-xl font-bold text-emerald-300">{stats.thisWeek}</div>
              <div className="text-[10px] text-emerald-200/70 uppercase tracking-wider mt-0.5">цього тижня</div>
            </div>
          </div>

          {stats.total === 0 && !loading && (
            <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-sm text-gray-400">
                Поки немає записів через бота.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Діліться посиланням на бота в Telegram — клієнти зможуть записуватися кнопками.
              </p>
            </div>
          )}

          {pendingBookings.length > 0 && (
            <div className="space-y-2 mb-4">
              <h4 className="text-sm font-semibold text-white">Очікують підтвердження</h4>
              {pendingBookings.slice(0, 3).map((b) => (
                <button
                  key={b.id}
                  onClick={() => router.push('/dashboard/appointments?status=Pending')}
                  className="w-full text-left rounded-xl p-3 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-white">{b.clientName}</p>
                      <p className="text-xs text-gray-400">{b.masterName} · {format(new Date(b.startTime), 'd MMM, HH:mm', { locale: uk })}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Підтвердити
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => router.push('/dashboard/appointments?source=telegram')}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#0088cc]/20 text-[#0088cc] border border-[#0088cc]/40 hover:bg-[#0088cc]/30 transition-colors"
            >
              Всі записи через TG
            </button>
            <button
              onClick={() => router.push('/dashboard/settings?tab=integrations')}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-white/20 text-gray-300 hover:bg-white/10 transition-colors"
            >
              Налаштування
            </button>
          </div>
        </>
      )}
    </div>
  )
}
