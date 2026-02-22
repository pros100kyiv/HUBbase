'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, parse } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { uk } from 'date-fns/locale'
import { startOfDay } from 'date-fns'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

type ManageData = {
  appointment: {
    id: string
    businessId: string
    masterId: string
    masterName: string | null
    clientName: string
    startTime: string
    endTime: string
    status: string
  }
  business: {
    id: string
    name: string
    slug: string
    location?: string | null
    timeZone: string
  }
  clientChangeSettings: {
    enabled: boolean
    allowReschedule: boolean
    allowCancel: boolean
    minHoursBefore: number
    requireMasterApproval: boolean
  }
  latestRequest?: {
    id: string
    type: string
    status: string
    requestedStartTime?: string | null
    requestedEndTime?: string | null
    clientNote?: string | null
    createdAt: string
    decidedAt?: string | null
    decisionNote?: string | null
  } | null
}

function statusLabelUa(status: string) {
  const s = String(status || '').toLowerCase()
  if (s === 'pending' || s.includes('очіку')) return 'Очікує підтвердження'
  if (s === 'confirmed' || s.includes('підтвер')) return 'Підтверджено'
  if (s === 'done' || s.includes('викон')) return 'Виконано'
  if (s === 'cancelled' || s.includes('скас')) return 'Скасовано'
  return status || '—'
}

export default function ManageAppointmentClient({ slug, token }: { slug: string; token: string }) {
  const [data, setData] = useState<ManageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [note, setNote] = useState('')

  const [recommendedSlots, setRecommendedSlots] = useState<Array<{ date: string; time: string; slot: string }>>([])
  const [recommendedSlotsLoading, setRecommendedSlotsLoading] = useState(false)
  const [availableSlotsForDate, setAvailableSlotsForDate] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [rescheduleDateStep, setRescheduleDateStep] = useState<'dates' | 'times'>('dates')

  const tz = data?.business?.timeZone || 'Europe/Kyiv'

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/booking/manage/${encodeURIComponent(token)}`, { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || 'Не вдалося завантажити запис')
        if (cancelled) return
        setData(json as ManageData)
        setNewDate('')
        setNewTime('')
        setRescheduleDateStep('dates')
      } catch (e) {
        if (!cancelled) {
          toast({ title: 'Помилка', description: e instanceof Error ? e.message : 'Не вдалося завантажити', type: 'error' })
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [token, tz])

  const durationMinutes = useMemo(() => {
    if (!data) return 30
    const start = new Date(data.appointment.startTime)
    const end = new Date(data.appointment.endTime)
    const m = Math.round((end.getTime() - start.getTime()) / 60000)
    return Number.isFinite(m) && m > 0 ? Math.max(15, Math.min(480, m)) : 30
  }, [data])

  const isFinalStatus = useMemo(() => {
    const s = String(data?.appointment?.status || '').toLowerCase()
    return s.includes('cancel') || s.includes('скас') || s.includes('done') || s.includes('викон')
  }, [data])

  const datesWithSlots = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const rec of recommendedSlots) {
      if (rec.date && !seen.has(rec.date)) {
        seen.add(rec.date)
        out.push(rec.date)
      }
    }
    return out.sort()
  }, [recommendedSlots])

  useEffect(() => {
    if (!data || !data.appointment.businessId || !data.appointment.masterId || isFinalStatus) return
    const fromStr = format(startOfDay(new Date()), 'yyyy-MM-dd')
    const params = new URLSearchParams({
      businessId: data.appointment.businessId,
      masterId: data.appointment.masterId,
      from: fromStr,
      days: '14',
      limit: '24',
      durationMinutes: String(durationMinutes),
    })
    setRecommendedSlotsLoading(true)
    fetch(`/api/availability?${params.toString()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { recommendedSlots: [] }))
      .then((d) => {
        const list = Array.isArray(d?.recommendedSlots) ? d.recommendedSlots : []
        const safe = list.filter(
          (rec: { date?: string; time?: string; slot?: string }) =>
            rec?.slot && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(rec.slot))
        )
        setRecommendedSlots(safe)
      })
      .catch(() => setRecommendedSlots([]))
      .finally(() => setRecommendedSlotsLoading(false))
  }, [data?.appointment?.businessId, data?.appointment?.masterId, durationMinutes, isFinalStatus])

  useEffect(() => {
    if (!newDate || !data?.appointment?.businessId || !data?.appointment?.masterId) {
      setAvailableSlotsForDate([])
      return
    }
    setSlotsLoading(true)
    const params = new URLSearchParams({
      businessId: data.appointment.businessId,
      masterId: data.appointment.masterId,
      date: newDate,
      durationMinutes: String(durationMinutes),
    })
    fetch(`/api/availability?${params.toString()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { availableSlots: [] }))
      .then((d) => {
        const raw = Array.isArray(d?.availableSlots) ? d.availableSlots : []
        setAvailableSlotsForDate(raw.filter((s: string) => typeof s === 'string' && s.startsWith(newDate)))
      })
      .catch(() => setAvailableSlotsForDate([]))
      .finally(() => setSlotsLoading(false))
  }, [newDate, data?.appointment?.businessId, data?.appointment?.masterId, durationMinutes])

  const handleSelectDate = (dateNorm: string) => {
    setNewDate(dateNorm)
    setNewTime('')
    setRescheduleDateStep('times')
  }

  const handleSelectTime = (time: string) => {
    setNewTime(time)
  }

  const handleBackToDates = () => {
    setNewDate('')
    setNewTime('')
    setRescheduleDateStep('dates')
  }

  const latestRequestText = useMemo(() => {
    if (!data?.latestRequest) return null
    const r = data.latestRequest
    const typeLabel = r.type === 'CANCEL' ? 'Скасування' : r.type === 'RESCHEDULE' ? 'Перенесення' : r.type
    const statusLabel =
      r.status === 'PENDING' ? 'Очікує підтвердження' : r.status === 'APPROVED' ? 'Підтверджено' : r.status === 'REJECTED' ? 'Відхилено' : r.status
    return `${typeLabel}: ${statusLabel}`
  }, [data])

  const requestReschedule = async () => {
    if (!data) return
    if (!newDate || !newTime) {
      toast({ title: 'Оберіть дату та час', type: 'info' })
      return
    }
    if (data.clientChangeSettings?.allowReschedule !== true) {
      toast({ title: 'Перенесення вимкнене', type: 'info' })
      return
    }
    const slot = `${newDate}T${newTime}`

    setBusy(true)
    try {
      // Client-side quick validation: check slot exists in availability.
      const aRes = await fetch(
        `/api/availability?businessId=${encodeURIComponent(data.appointment.businessId)}&masterId=${encodeURIComponent(
          data.appointment.masterId
        )}&date=${encodeURIComponent(newDate)}&durationMinutes=${encodeURIComponent(String(durationMinutes))}`,
        { cache: 'no-store' }
      )
      const aJson = await aRes.json().catch(() => ({}))
      const slots: string[] = Array.isArray(aJson?.availableSlots) ? aJson.availableSlots : []
      if (!slots.includes(slot)) {
        toast({ title: 'Час недоступний', description: 'Оберіть інший час (цей вже зайнятий або поза графіком).', type: 'error' })
        return
      }

      const res = await fetch('/api/booking/change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          type: 'RESCHEDULE',
          slot,
          durationMinutes,
          note: note.trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Не вдалося створити запит')
      toast({ title: 'Запит відправлено', description: 'Майстер побачить запит у кабінеті та підтвердить або відхилить.', type: 'success' })

      // Reload state to show latest request status.
      const reload = await fetch(`/api/booking/manage/${encodeURIComponent(token)}`, { cache: 'no-store' })
      const reloadJson = await reload.json().catch(() => ({}))
      if (reload.ok) setData(reloadJson as ManageData)
    } catch (e) {
      toast({ title: 'Помилка', description: e instanceof Error ? e.message : 'Не вдалося створити запит', type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const requestCancel = async () => {
    if (!data) return
    if (data.clientChangeSettings?.allowCancel !== true) {
      toast({ title: 'Скасування вимкнене', type: 'info' })
      return
    }
    if (!confirm('Скасувати запис? Потрібне підтвердження майстра.')) return
    setBusy(true)
    try {
      const res = await fetch('/api/booking/change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          type: 'CANCEL',
          note: note.trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Не вдалося створити запит')
      toast({ title: 'Запит на скасування відправлено', type: 'success' })

      const reload = await fetch(`/api/booking/manage/${encodeURIComponent(token)}`, { cache: 'no-store' })
      const reloadJson = await reload.json().catch(() => ({}))
      if (reload.ok) setData(reloadJson as ManageData)
    } catch (e) {
      toast({ title: 'Помилка', description: e instanceof Error ? e.message : 'Не вдалося', type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen py-6 px-3 md:px-6">
        <div className="max-w-xl mx-auto rounded-2xl p-5 card-glass border border-black/10 dark:border-white/10 text-center">
          <div className="w-10 h-10 rounded-full border-2 border-black/15 dark:border-white/15 border-t-black/50 dark:border-t-white/60 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-300">Завантаження...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen py-6 px-3 md:px-6">
        <div className="max-w-xl mx-auto rounded-2xl p-5 card-glass border border-black/10 dark:border-white/10 text-center">
          <p className="text-base font-semibold text-foreground dark:text-white">Запис не знайдено</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Перевірте посилання або створіть новий запис.</p>
          <a
            href={slug ? `/booking/${slug}` : '/'}
            className="mt-4 inline-flex items-center justify-center px-4 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            Повернутися до бронювання
          </a>
        </div>
      </div>
    )
  }

  const start = new Date(data.appointment.startTime)
  const end = new Date(data.appointment.endTime)
  const whenLabel = `${formatInTimeZone(start, tz, 'd MMMM yyyy', { locale: uk })}, ${formatInTimeZone(start, tz, 'HH:mm', { locale: uk })}–${formatInTimeZone(end, tz, 'HH:mm', { locale: uk })}`

  return (
    <div className="min-h-screen py-5 px-3 md:px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="rounded-2xl p-4 card-glass border border-black/10 dark:border-white/10">
          <p className="text-xs text-gray-500 dark:text-gray-400">Керування записом</p>
          <h1 className="text-lg font-bold text-foreground dark:text-white mt-1">{data.business?.name || '—'}</h1>
          {data.business?.location ? (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{data.business.location}</p>
          ) : null}

          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">Статус:</span>
              <span className="font-semibold text-foreground dark:text-white">{statusLabelUa(data.appointment.status)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">Спеціаліст:</span>
              <span className="font-medium text-foreground dark:text-white text-right">{data.appointment.masterName || '—'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">Коли:</span>
              <span className="font-medium text-foreground dark:text-white text-right">{whenLabel}</span>
            </div>
          </div>
        </div>

        {latestRequestText && (
          <div className="rounded-2xl p-4 card-glass border border-black/10 dark:border-white/10">
            <p className="text-sm font-semibold text-foreground dark:text-white">Останній запит</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{latestRequestText}</p>
            {data.latestRequest?.decisionNote ? (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{data.latestRequest.decisionNote}</p>
            ) : null}
          </div>
        )}

        <div className="rounded-2xl p-4 card-glass border border-black/10 dark:border-white/10">
          <p className="text-sm font-semibold text-foreground dark:text-white">Повідомлення (необовʼязково)</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Напишіть майстру причину або побажання..."
            rows={3}
            className={cn(
              'mt-2 w-full px-3 py-3 rounded-xl border bg-black/[0.03] dark:bg-white/10 text-foreground dark:text-white placeholder-gray-500 dark:placeholder-gray-400',
              'border-black/10 dark:border-white/15 focus:outline-none focus:ring-2 focus:ring-black/15 dark:focus:ring-white/25'
            )}
          />
        </div>

        <div className="rounded-2xl p-4 card-glass border border-black/10 dark:border-white/10">
          <p className="text-sm font-semibold text-foreground dark:text-white">Перенести запис</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Можна змінити мінімум за {data.clientChangeSettings.minHoursBefore} год до візиту. Потрібне підтвердження майстра.
          </p>

          {rescheduleDateStep === 'dates' && (
            <div className="mt-3 space-y-3">
              {recommendedSlots.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Найближчі вільні:</p>
                  <div className="flex flex-wrap gap-2">
                    {recommendedSlots.slice(0, 6).map((rec) => {
                      const isSelected = newDate === rec.date && newTime === rec.time
                      const label = (() => {
                        try {
                          const d = parse(rec.date, 'yyyy-MM-dd', new Date())
                          const today = startOfDay(new Date())
                          if (format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) return `Сьогодні ${rec.time}`
                          const tomorrow = new Date(today.getTime() + 86400000)
                          if (format(d, 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd')) return `Завтра ${rec.time}`
                          return `${format(d, 'd MMM', { locale: uk })} ${rec.time}`
                        } catch {
                          return `${rec.date} ${rec.time}`
                        }
                      })()
                      return (
                        <button
                          key={rec.slot}
                          type="button"
                          onClick={() => {
                            setNewDate(rec.date)
                            setNewTime(rec.time)
                            setRescheduleDateStep('times')
                            setSlotsLoading(true)
                            fetch(`/api/availability?date=${rec.date}&durationMinutes=${durationMinutes}&limit=24`, { cache: 'no-store' })
                              .then((r) => (r.ok ? r.json() : { availableSlots: [] }))
                              .then((d: { availableSlots?: string[] }) => {
                                const list = Array.isArray(d?.availableSlots) ? d.availableSlots : []
                                setAvailableSlotsForDate(list.length > 0 ? list : [rec.slot])
                              })
                              .catch(() => setAvailableSlotsForDate([rec.slot]))
                              .finally(() => setSlotsLoading(false))
                          }}
                          className={cn(
                            'min-h-[40px] px-3 py-2 rounded-lg text-xs font-medium transition-colors active:scale-[0.98]',
                            isSelected
                              ? 'bg-white text-black shadow-md ring-2 ring-black/20'
                              : 'bg-black/[0.04] dark:bg-white/10 border border-black/10 dark:border-white/15 text-foreground dark:text-white hover:bg-black/[0.06] dark:hover:bg-white/15'
                          )}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Або оберіть дату:</p>
              {recommendedSlotsLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-3">Завантаження вільних дат...</p>
              ) : datesWithSlots.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-3">Немає вільних дат на найближчі 14 днів.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {datesWithSlots.slice(0, 10).map((dateNorm) => {
                    try {
                      const d = parse(dateNorm, 'yyyy-MM-dd', new Date())
                      const today = startOfDay(new Date())
                      const label =
                        format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
                          ? 'Сьогодні'
                          : format(d, 'yyyy-MM-dd') === format(new Date(today.getTime() + 86400000), 'yyyy-MM-dd')
                            ? 'Завтра'
                            : format(d, 'EEE d.MM', { locale: uk })
                      return (
                        <button
                          key={dateNorm}
                          type="button"
                          onClick={() => handleSelectDate(dateNorm)}
                          className="min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-medium bg-black/[0.04] dark:bg-white/10 border border-black/10 dark:border-white/15 text-foreground dark:text-white hover:bg-black/[0.06] dark:hover:bg-white/15 transition-colors active:scale-[0.98]"
                        >
                          {label}
                        </button>
                      )
                    } catch {
                      return null
                    }
                  })}
                </div>
              )}
              </div>
            </div>
          )}

          {rescheduleDateStep === 'times' && newDate && (
            <div className="mt-3">
              <button
                type="button"
                onClick={handleBackToDates}
                className="text-xs text-gray-600 dark:text-gray-400 hover:text-foreground dark:hover:text-white mb-2 flex items-center gap-1"
              >
                ← Інша дата
              </button>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Оберіть вільний час на {format(parse(newDate, 'yyyy-MM-dd', new Date()), 'd MMMM', { locale: uk })}:
              </p>
              {slotsLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-3">Завантаження...</p>
              ) : availableSlotsForDate.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-3">На цю дату немає вільних годин.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlotsForDate.slice(0, 18).map((slotStr) => {
                    const time = String(slotStr).slice(11, 16)
                    const isSelected = newTime === time
                    return (
                      <button
                        key={slotStr}
                        type="button"
                        onClick={() => handleSelectTime(time)}
                        className={cn(
                          'min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-medium transition-colors active:scale-[0.98]',
                          isSelected
                            ? 'bg-white text-black shadow-md ring-2 ring-black/20 dark:ring-white/50'
                            : 'bg-black/[0.04] dark:bg-white/10 border border-black/10 dark:border-white/15 text-foreground dark:text-white hover:bg-black/[0.06] dark:hover:bg-white/15'
                        )}
                      >
                        {time}
                      </button>
                    )
                  })}
                </div>
              )}
              {availableSlotsForDate.length > 0 && newTime && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  Обрано: {newDate} о {newTime}
                </p>
              )}
            </div>
          )}

          {newDate && newTime && (
            <button
              type="button"
              onClick={requestReschedule}
              disabled={busy || isFinalStatus || data.clientChangeSettings.allowReschedule !== true}
              className={cn(
                'mt-3 w-full min-h-[48px] px-4 py-3 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]',
                'bg-white text-black hover:bg-gray-100 disabled:opacity-60'
              )}
            >
              {busy ? 'Відправлення...' : 'Надіслати запит на перенесення'}
            </button>
          )}
        </div>

        <div className="rounded-2xl p-4 card-glass border border-black/10 dark:border-white/10">
          <p className="text-sm font-semibold text-foreground dark:text-white">Скасувати запис</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Після відправки запиту майстер має підтвердити скасування.
          </p>
          <button
            type="button"
            onClick={requestCancel}
            disabled={busy || isFinalStatus || data.clientChangeSettings.allowCancel !== true}
            className={cn(
              'mt-3 w-full min-h-[48px] px-4 py-3 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]',
              'bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-60'
            )}
          >
            {busy ? 'Відправлення...' : 'Надіслати запит на скасування'}
          </button>
        </div>
      </div>
    </div>
  )
}

