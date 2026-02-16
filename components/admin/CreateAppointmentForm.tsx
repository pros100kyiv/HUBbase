'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format, isValid } from 'date-fns'
import { toast } from '@/components/ui/toast'
import { ModalPortal } from '@/components/ui/modal-portal'
import { normalizeUaPhone, isValidUaPhone } from '@/lib/utils/phone'

/** Нормалізує час до HH:mm для коректного парсингу дати та відображення. */
function normalizeHHmm(t: string): string {
  const match = String(t).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return '09:00'
  const h = Math.max(0, Math.min(23, parseInt(match[1], 10) || 0))
  const m = Math.max(0, Math.min(59, parseInt(match[2], 10) || 0))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

interface CreateAppointmentFormProps {
  businessId: string
  masters: Array<{ id: string; name: string }>
  services: Array<{ id: string; name: string; price: number; duration: number }>
  selectedDate?: Date
  /** Початковий час запису (HH:mm), наприклад з «Вільні години» */
  initialStartTime?: string
  /** Початковий спеціаліст (ID), наприклад з «Вільні години» */
  initialMasterId?: string
  onSuccess: () => void
  onCancel: () => void
  /** У модальному вікні — без Card і заголовка */
  embedded?: boolean
  /** Початкові дані клієнта (наприклад після пошуку за телефоном або створення картки) */
  initialClientName?: string
  initialClientPhone?: string
  /** Клієнт уже обраний (перехід з картки клієнта) — не показувати поля телефону/імені, тільки дата, час, спеціаліст, послуги */
  clientLocked?: boolean
  /** Уникнути модалки в модалці: вибір послуг показувати inline у тій самій модалці */
  inlineServicePicker?: boolean
}

export function CreateAppointmentForm({
  businessId,
  masters,
  services,
  selectedDate,
  initialStartTime,
  initialMasterId,
  onSuccess,
  onCancel,
  embedded = false,
  initialClientName = '',
  initialClientPhone = '',
  clientLocked = false,
  inlineServicePicker = false,
}: CreateAppointmentFormProps) {
  const formRef = useRef<HTMLDivElement>(null)
  const initialDate = selectedDate && isValid(selectedDate) ? selectedDate : new Date()
  const resolvedInitialMasterId =
    initialMasterId && masters.some((m) => m.id === initialMasterId) ? initialMasterId : masters[0]?.id || ''
  const [formData, setFormData] = useState({
    masterId: resolvedInitialMasterId,
    clientName: initialClientName,
    clientPhone: initialClientPhone,
    serviceIds: [] as string[],
    date: format(initialDate, 'yyyy-MM-dd'),
    startTime: (initialStartTime && /^\d{1,2}:\d{2}$/.test(initialStartTime) ? normalizeHHmm(initialStartTime) : '09:00'),
    customService: '',
    customPrice: 0,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [serviceSearchQuery, setServiceSearchQuery] = useState('')
  const [clientLookupStatus, setClientLookupStatus] = useState<'idle' | 'loading' | 'found' | 'not_found'>('idle')
  const lookupAbortRef = useRef<AbortController | null>(null)
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  useEffect(() => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  useEffect(() => {
    if (!showServiceModal || inlineServicePicker) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowServiceModal(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showServiceModal, inlineServicePicker])

  // Коли завантажився список майстрів — авто-обрати initialMasterId (з «Вільні години») або першого
  useEffect(() => {
    if (masters.length === 0) return
    const preferredId =
      initialMasterId && masters.some((m) => m.id === initialMasterId) ? initialMasterId : masters[0].id
    setFormData((prev) => {
      if (prev.masterId && masters.some((m) => m.id === prev.masterId)) return prev
      return { ...prev, masterId: preferredId }
    })
  }, [masters, initialMasterId])

  // Клієнт з картки: підтягнути ім'я/телефон з props (форма може змонтуватись пізніше за client state)
  useEffect(() => {
    if (clientLocked && (initialClientPhone || initialClientName)) {
      setFormData((prev) => ({
        ...prev,
        clientName: initialClientName?.trim() || prev.clientName,
        clientPhone: initialClientPhone?.trim() || prev.clientPhone,
      }))
    }
  }, [clientLocked, initialClientPhone, initialClientName])

  // Тривалість: сума обраних послуг або 30 хв
  const durationMinutes = useMemo(() => {
    const total = formData.serviceIds.reduce((sum, id) => {
      const s = services.find((x) => x.id === id)
      return sum + (s?.duration ?? 30)
    }, 0)
    return total > 0 ? total : 30
  }, [formData.serviceIds, services])

  // Завантаження вільних слотів при зміні дати, спеціаліста або тривалості
  useEffect(() => {
    if (!businessId || !formData.masterId || !formData.date) {
      setAvailableSlots([])
      return
    }
    const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(formData.date)
    if (!dateMatch) {
      setAvailableSlots([])
      return
    }
    let cancelled = false
    setSlotsLoading(true)
    const params = new URLSearchParams({
      businessId,
      masterId: formData.masterId,
      date: formData.date,
      durationMinutes: String(durationMinutes),
    })
    fetch(`/api/availability?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { availableSlots: [] }))
      .then((data) => {
        if (cancelled) return
        const raw: unknown[] = Array.isArray(data?.availableSlots) ? data.availableSlots : []
        const times = raw
          .filter((s: unknown): s is string => typeof s === 'string')
          .map((s: string) => {
            const t = s.includes('T') ? s.slice(11, 16) : s
            return /^\d{1,2}:\d{2}$/.test(t) ? t : null
          })
          .filter((t): t is string => Boolean(t))
        setAvailableSlots(times)
        setFormData((prev) => {
          const current = prev.startTime
          if (times.includes(current)) return prev
          return { ...prev, startTime: times[0] || '09:00' }
        })
      })
      .catch(() => {
        if (!cancelled) setAvailableSlots([])
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false)
      })
    return () => { cancelled = true }
  }, [businessId, formData.masterId, formData.date, durationMinutes])

  // Пошук клієнта за телефоном: якщо є в базі — підтягнути ім'я; якщо немає — залишити поле для вводу (при створенні запису клієнт створиться через API)
  useEffect(() => {
    const raw = formData.clientPhone.trim()
    const digitsOnly = raw.replace(/\D/g, '')
    if (digitsOnly.length < 9 || !businessId) {
      setClientLookupStatus('idle')
      return
    }

    const normalized = normalizeUaPhone(raw)
    if (normalized.length < 13) return

    const t = setTimeout(async () => {
      if (lookupAbortRef.current) lookupAbortRef.current.abort()
      lookupAbortRef.current = new AbortController()
      setClientLookupStatus('loading')
      try {
        const res = await fetch(
          `/api/clients?businessId=${encodeURIComponent(businessId)}&phone=${encodeURIComponent(normalized)}`,
          { signal: lookupAbortRef.current.signal }
        )
        if (!res.ok) {
          setClientLookupStatus('not_found')
          return
        }
        const data = await res.json()
        const list = Array.isArray(data) ? data : []
        if (list.length > 0 && list[0].name) {
          setFormData((prev) => ({ ...prev, clientName: list[0].name }))
          setClientLookupStatus('found')
        } else {
          setClientLookupStatus('not_found')
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        setClientLookupStatus('not_found')
      } finally {
        lookupAbortRef.current = null
      }
    }, 500)

    return () => {
      clearTimeout(t)
      if (lookupAbortRef.current) {
        lookupAbortRef.current.abort()
        lookupAbortRef.current = null
      }
    }
  }, [formData.clientPhone, businessId])

  /* Єдиний вигляд полів у модалці: одна форма, розмір, компактні (32px висота, rounded-md) */
  const embeddedFieldBase =
    'min-h-[32px] h-[32px] py-1.5 px-2.5 text-sm rounded-md border border-white/20 bg-white/5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30'
  const embeddedFieldClass = `w-full ${embeddedFieldBase}`

  const clientPhoneDigits = (formData.clientPhone || '').replace(/\D/g, '')
  const hasClientPhone = clientPhoneDigits.length >= 9
  const hasClientName = Boolean((formData.clientName || '').trim())
  const canSubmit =
    Boolean(formData.masterId) &&
    (clientLocked || (hasClientName && hasClientPhone)) &&
    availableSlots.length > 0 &&
    !isSubmitting

  // <details> не має defaultOpen у типах React, тому тримаємо open станом.
  // Авто-відкриваємо тільки коли потрібно заповнити обовʼязкові поля клієнта.
  const [clientDetailsOpen, setClientDetailsOpen] = useState(() => {
    const initPhoneDigits = String(initialClientPhone || '').replace(/\D/g, '')
    const initHasPhone = initPhoneDigits.length >= 9
    const initHasName = Boolean(String(initialClientName || '').trim())
    return !clientLocked && (!initHasPhone || !initHasName)
  })
  const [optionalDetailsOpen, setOptionalDetailsOpen] = useState(() => {
    return formData.serviceIds.length > 0 || Boolean(formData.customService.trim()) || formData.customPrice > 0
  })

  const clientDisplayName = (formData.clientName || '').trim() || '—'
  const clientDisplayPhone = (formData.clientPhone || '').trim()
  const clientInitial = (clientDisplayName || '—').trim().charAt(0).toUpperCase() || '—'
  const iconBtnClass =
    'inline-flex items-center justify-center w-8 h-8 rounded-lg border border-white/15 bg-white/5 text-gray-200 hover:bg-white/10 hover:text-white transition-colors'

  useEffect(() => {
    if (clientLocked) return
    const shouldOpen = !hasClientPhone || !hasClientName || clientLookupStatus === 'not_found'
    if (shouldOpen) setClientDetailsOpen(true)
  }, [clientLocked, hasClientPhone, hasClientName, clientLookupStatus])

  const handleServiceToggle = (serviceId: string) => {
    setFormData((prev) => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter((id) => id !== serviceId)
        : [...prev.serviceIds, serviceId],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Валідація: обов'язкові поля та формат телефону
    if (!clientLocked) {
      const name = formData.clientName?.trim() ?? ''
      const phone = formData.clientPhone?.trim() ?? ''
      if (!name) {
        toast({ title: 'Помилка', description: "Введіть ім'я клієнта", type: 'error' })
        return
      }
      if (!phone) {
        toast({ title: 'Помилка', description: 'Введіть номер телефону клієнта', type: 'error' })
        return
      }
      if (!isValidUaPhone(phone)) {
        toast({ title: 'Помилка', description: 'Введіть коректний український номер (наприклад 0671234567)', type: 'error' })
        return
      }
    }

    if (!formData.masterId) {
      toast({ title: 'Помилка', description: 'Оберіть спеціаліста', type: 'error' })
      return
    }

    setIsSubmitting(true)
    try {
      const startDateTime = new Date(`${formData.date}T${formData.startTime}`)
      const selectedServices = services.filter((s) => formData.serviceIds.includes(s.id))
      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0)
      // Якщо послуги не вибрані — дефолтна тривалість 30 хвилин
      const effectiveDuration = totalDuration > 0 ? totalDuration : 30
      const endDateTime = new Date(startDateTime.getTime() + effectiveDuration * 60000)

      const appointmentData: any = {
        businessId,
        masterId: formData.masterId,
        clientName: formData.clientName,
        clientPhone: formData.clientPhone,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        services: formData.serviceIds.length > 0 ? JSON.stringify(formData.serviceIds) : JSON.stringify([]),
        isFromBooking: false,
      }

      if (formData.customService.trim()) {
        appointmentData.customServiceName = formData.customService.trim()
        appointmentData.customPrice = formData.customPrice > 0 ? formData.customPrice * 100 : null
      }

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointmentData),
      })

      if (!response.ok) {
        let errorData: { error?: string; details?: string } = {}
        try {
          errorData = await response.json()
        } catch {
          errorData = { error: 'Помилка сервера. Спробуйте пізніше.' }
        }
        const msg = errorData.error || 'Не вдалося створити запис'
        throw new Error(msg)
      }

      toast({ title: 'Запис створено', type: 'success' })
      onSuccess()
    } catch (error) {
      console.error('Error creating appointment:', error)
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося створити запис',
        type: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formContent = (
    <form onSubmit={handleSubmit} className={embedded ? 'space-y-2.5' : 'space-y-4'}>
      {/* Основне (обовʼязкове): компактна сітка, щоб не виглядало "списком з 100 полів" */}
      <div className={embedded ? 'rounded-xl border border-white/10 bg-white/5 p-2.5' : undefined}>
        <div className={embedded ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'space-y-4'}>
          {/* Master Selection */}
          <div className={embedded ? 'sm:col-span-2' : undefined}>
            <label className={`block font-medium text-foreground ${embedded ? 'text-xs mb-0.5' : 'text-sm mb-2'}`}>
              Спеціаліст <span className="text-rose-400">*</span>
            </label>
            <select
              value={formData.masterId}
              onChange={(e) => setFormData({ ...formData, masterId: e.target.value })}
              required
              className={embedded ? embeddedFieldClass : 'w-full px-3 py-2.5 sm:py-2 min-h-[48px] sm:min-h-0 border border-gray-300 dark:border-gray-700 rounded-candy-sm bg-white dark:bg-gray-800 text-foreground'}
            >
              <option value="">Оберіть спеціаліста</option>
              {masters.map((master) => (
                <option key={master.id} value={master.id}>
                  {master.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className={`block font-medium text-foreground ${embedded ? 'text-xs mb-0.5' : 'text-sm mb-2'}`}>
              Дата <span className="text-rose-400">*</span>
            </label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              min={format(new Date(), 'yyyy-MM-dd')}
              className={embedded ? embeddedFieldClass : undefined}
            />
          </div>

          {/* Start Time — тільки вільні слоти (заблоковані зайняті) */}
          <div>
            <label className={`block font-medium text-foreground ${embedded ? 'text-xs mb-0.5' : 'text-sm mb-2'}`}>
              Час <span className="text-rose-400">*</span>
            </label>
            {slotsLoading ? (
              <p className="text-sm text-muted-foreground py-2">Завантаження вільних слотів…</p>
            ) : availableSlots.length === 0 ? (
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-2">
                <p className="text-sm text-amber-200 leading-snug">
                  Немає вільних слотів на цей день. Оберіть іншу дату або спеціаліста.
                </p>
              </div>
            ) : (
              <select
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
                className={embedded ? embeddedFieldClass : 'w-full px-3 py-2.5 sm:py-2 min-h-[48px] sm:min-h-0 border border-gray-300 dark:border-gray-700 rounded-candy-sm bg-white dark:bg-gray-800 text-foreground'}
              >
                {availableSlots.map((slot) => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Клієнт: показуємо короткий рядок + опційно розкриваємо редагування */}
      {clientLocked && hasClientPhone ? (
        <div className={embedded ? 'rounded-xl border border-white/10 bg-white/5 p-2.5' : 'rounded-xl border border-white/10 bg-white/5 p-3'}>
          <p className="text-xs font-medium text-gray-400 mb-1">Клієнт</p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-white">{clientInitial}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{clientDisplayName}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate tabular-nums">{clientDisplayPhone}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {clientDisplayPhone && (
                <a
                  href={`tel:${clientDisplayPhone}`}
                  className={iconBtnClass}
                  title="Зателефонувати"
                  aria-label="Зателефонувати"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </a>
              )}
              {clientDisplayPhone && (
                <button
                  type="button"
                  className={iconBtnClass}
                  title="Копіювати номер"
                  aria-label="Копіювати номер"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigator.clipboard?.writeText(clientDisplayPhone)
                    toast({ title: 'Скопійовано', description: clientDisplayPhone, type: 'success', duration: 2000 })
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M8 16a2 2 0 002 2h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8z" />
                  </svg>
                </button>
              )}
              <a
                href={`/dashboard/clients?phone=${encodeURIComponent(normalizeUaPhone(clientDisplayPhone))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-primary hover:underline whitespace-nowrap ml-1"
                onClick={(e) => e.stopPropagation()}
              >
                Картка
              </a>
            </div>
          </div>
        </div>
      ) : (
        <details
          className={embedded ? 'rounded-xl border border-white/10 bg-white/5 p-2.5' : 'rounded-xl border border-white/10 bg-white/5 p-3'}
          open={clientDetailsOpen}
          onToggle={(e) => setClientDetailsOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer list-none select-none flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-white">{clientInitial}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-400">Клієнт</p>
                <p className="text-sm font-semibold text-white truncate">
                  {hasClientName ? formData.clientName.trim() : 'Вкажіть імʼя та телефон'}
                </p>
                {hasClientPhone && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate tabular-nums">{formData.clientPhone}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {clientLookupStatus === 'found' && (
                <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                  знайдено
                </span>
              )}
              {hasClientPhone && (
                <a
                  href={`tel:${formData.clientPhone}`}
                  className={iconBtnClass}
                  title="Зателефонувати"
                  aria-label="Зателефонувати"
                  onClick={(e) => {
                    // Не відкривати/закривати <details> по кліку на кнопку дії
                    e.stopPropagation()
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </a>
              )}
              {hasClientPhone && (
                <button
                  type="button"
                  className={iconBtnClass}
                  title="Копіювати номер"
                  aria-label="Копіювати номер"
                  onClick={(e) => {
                    e.stopPropagation()
                    const phone = formData.clientPhone.trim()
                    navigator.clipboard?.writeText(phone)
                    toast({ title: 'Скопійовано', description: phone, type: 'success', duration: 2000 })
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M8 16a2 2 0 002 2h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8z" />
                  </svg>
                </button>
              )}
              {hasClientPhone && (
                <a
                  href={`/dashboard/clients?phone=${encodeURIComponent(normalizeUaPhone(formData.clientPhone))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-primary hover:underline whitespace-nowrap px-2 py-1"
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                >
                  Картка
                </a>
              )}
              <span className="text-xs text-gray-400">{clientDetailsOpen ? 'Згорнути' : 'Редагувати'}</span>
            </div>
          </summary>

          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={`block font-medium text-foreground ${embedded ? 'text-xs mb-0.5' : 'text-sm mb-2'}`}>
                Ім'я <span className="text-rose-400">*</span>
              </label>
              <Input
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                placeholder="Введіть ім'я клієнта"
                required
                className={embedded ? embeddedFieldClass : undefined}
              />
            </div>
            <div>
              <label className={`block font-medium text-foreground ${embedded ? 'text-xs mb-0.5' : 'text-sm mb-2'}`}>
                Телефон <span className="text-rose-400">*</span>
              </label>
              <div className="flex gap-2 items-center">
                <Input
                  type="tel"
                  value={formData.clientPhone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, clientPhone: e.target.value }))}
                  placeholder="0XX XXX XX XX"
                  required
                  className={embedded ? `flex-1 min-w-0 ${embeddedFieldClass}` : 'flex-1 min-w-0'}
                />
                {hasClientPhone && (
                  <a
                    href={`/dashboard/clients?phone=${encodeURIComponent(normalizeUaPhone(formData.clientPhone))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                  >
                    Картка
                  </a>
                )}
              </div>
              {clientLookupStatus === 'loading' && (
                <p className="text-xs text-muted-foreground mt-0.5">Пошук клієнта…</p>
              )}
              {clientLookupStatus === 'found' && (
                <p className="text-xs text-emerald-300 mt-0.5">Клієнт знайдено в базі</p>
              )}
              {clientLookupStatus === 'not_found' && hasClientPhone && (
                <p className="text-xs text-amber-300 mt-0.5">Новий клієнт — введіть ім'я</p>
              )}
            </div>
          </div>
        </details>
      )}

      {/* Опціональне: сховати в секцію, щоб не "зливалося" */}
      <details
        className={embedded ? 'rounded-xl border border-white/10 bg-white/5 p-2.5' : undefined}
        open={optionalDetailsOpen}
        onToggle={(e) => setOptionalDetailsOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className={embedded ? 'cursor-pointer list-none select-none flex items-center justify-between gap-2' : 'cursor-pointer'}>
          <div className="min-w-0">
            <p className={`font-medium text-foreground ${embedded ? 'text-xs' : 'text-sm'}`}>
              Опціонально
              {formData.serviceIds.length > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  послуги: {formData.serviceIds.length}
                </span>
              )}
            </p>
            {embedded && (
              <p className="text-[11px] text-gray-400 mt-0.5">Послуги та додаткова послуга</p>
            )}
          </div>
          {embedded && (
            <span className="text-xs text-gray-400 flex-shrink-0">
              {optionalDetailsOpen ? 'Сховати' : 'Показати'}
            </span>
          )}
        </summary>

        <div className={embedded ? 'mt-2 space-y-2' : 'mt-2 space-y-4'}>
          {/* Services */}
          <div>
            <label className={`block font-medium text-foreground ${embedded ? 'text-xs mb-0.5' : 'text-sm mb-2'}`}>
              Послуги
            </label>
            <div className={`flex flex-col ${embedded ? 'gap-1' : 'gap-2'}`}>
              {embedded ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setServiceSearchQuery('')
                      setShowServiceModal(!showServiceModal)
                    }}
                    className="inline-flex items-center justify-center gap-1 min-h-[32px] h-[32px] px-2.5 py-1.5 text-xs font-medium rounded-md border border-white/20 bg-white/5 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 touch-manipulation w-full sm:w-auto sm:max-w-[180px]"
                  >
                    {showServiceModal ? 'Приховати список' : 'Обрати послуги'}
                    {formData.serviceIds.length > 0 && (
                      <span className="text-xs opacity-80">({formData.serviceIds.length})</span>
                    )}
                  </button>
                  {inlineServicePicker && showServiceModal && (
                    <div className="rounded-xl border border-white/15 bg-white/5 p-2 mt-1 max-h-[min(50vh,280px)] overflow-y-auto scrollbar-hide space-y-2">
                      <input
                        type="text"
                        value={serviceSearchQuery}
                        onChange={(e) => setServiceSearchQuery(e.target.value)}
                        placeholder="Пошук за назвою..."
                        className="w-full px-2.5 py-2 min-h-[36px] text-sm border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30"
                      />
                      <div className="space-y-1">
                        {services
                          .filter((s) =>
                            s.name.toLowerCase().includes(serviceSearchQuery.trim().toLowerCase())
                          )
                          .map((service) => (
                            <label
                              key={service.id}
                              className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-white/[0.06] min-h-[44px] touch-target"
                            >
                              <input
                                type="checkbox"
                                checked={formData.serviceIds.includes(service.id)}
                                onChange={() => handleServiceToggle(service.id)}
                                className="rounded border-white/30 bg-white/10 text-primary focus:ring-primary"
                              />
                              <span className="flex-1 text-sm font-medium text-white">{service.name}</span>
                              <span className="text-xs text-gray-400">
                                {Math.round(service.price)} грн · {service.duration} хв
                              </span>
                            </label>
                          ))}
                        {services.filter((s) =>
                          s.name.toLowerCase().includes(serviceSearchQuery.trim().toLowerCase())
                        ).length === 0 && (
                          <p className="p-3 text-center text-xs text-gray-400">
                            {serviceSearchQuery.trim() ? 'Нічого не знайдено' : 'Немає послуг'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setServiceSearchQuery('')
                    setShowServiceModal(true)
                  }}
                  className="w-full justify-center border-gray-300 dark:border-gray-600 text-foreground"
                >
                  Обрати послуги
                  {formData.serviceIds.length > 0 && (
                    <span className="ml-2 text-xs opacity-80">({formData.serviceIds.length})</span>
                  )}
                </Button>
              )}
              {formData.serviceIds.length > 0 && (
                <div className={embedded
                  ? 'flex flex-wrap gap-1 rounded-md border border-white/10 bg-white/5 p-1'
                  : 'flex flex-wrap gap-1.5 p-2 border border-gray-200 dark:border-gray-700 rounded-candy-sm bg-gray-50 dark:bg-gray-800/50 min-h-[44px]'
                }>
                  {formData.serviceIds.map((id) => {
                    const s = services.find((x) => x.id === id)
                    return s ? (
                      <span
                        key={id}
                        className={embedded
                          ? 'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] bg-primary/10 text-primary dark:bg-primary/20 border border-primary/30'
                          : 'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-primary/10 text-primary dark:bg-primary/20 border border-primary/30'
                        }
                      >
                        {s.name}
                        <button
                          type="button"
                          onClick={() => handleServiceToggle(id)}
                          className={embedded ? 'p-0.5 rounded hover:bg-primary/20 -m-0.5' : 'ml-0.5 p-0.5 rounded hover:bg-primary/20'}
                          aria-label="Прибрати"
                        >
                          ×
                        </button>
                      </span>
                    ) : null
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Custom Service */}
          <div>
            <label className={`block font-medium text-foreground ${embedded ? 'text-xs mb-0.5' : 'text-sm mb-2'}`}>
              Додаткова послуга
            </label>
            <div className="flex gap-2">
              <Input
                value={formData.customService}
                onChange={(e) => setFormData({ ...formData, customService: e.target.value })}
                placeholder="Назва"
                className={embedded ? `flex-1 min-w-0 ${embeddedFieldClass}` : 'flex-1'}
              />
              <Input
                type="number"
                value={formData.customPrice}
                onChange={(e) => setFormData({ ...formData, customPrice: Number(e.target.value) })}
                placeholder="₴"
                min="0"
                className={embedded ? `w-16 min-w-[4rem] shrink-0 ${embeddedFieldBase}` : 'w-24'}
              />
            </div>
          </div>
        </div>
      </details>

      {/* Modal вибору послуг — тільки якщо не inline (уникнути модалки в модалці) */}
      {showServiceModal && !inlineServicePicker && (
              <ModalPortal>
                <div
                  className="modal-overlay modal-overlay-nested sm:!p-4"
                  onClick={() => setShowServiceModal(false)}
                >
                  <div
                    className="relative w-[95%] sm:w-full sm:max-w-md sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setShowServiceModal(false)}
                      className="modal-close touch-target text-gray-400 hover:text-white rounded-full"
                      aria-label="Закрити"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <h3 className="modal-title pr-10 mb-1.5">Обрати послуги</h3>
                    <div className="p-1.5 pb-2 border-b border-white/10 flex-shrink-0">
                      <input
                        type="text"
                        value={serviceSearchQuery}
                        onChange={(e) => setServiceSearchQuery(e.target.value)}
                        placeholder="Пошук за назвою..."
                        className="w-full px-3 py-2 min-h-[44px] border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30"
                        autoFocus
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                      {services
                        .filter((s) =>
                          s.name.toLowerCase().includes(serviceSearchQuery.trim().toLowerCase())
                        )
                        .map((service) => (
                          <label
                            key={service.id}
                            className="flex items-center gap-3 p-3 rounded-xl card-glass cursor-pointer transition-all hover:bg-white/[0.08] active:scale-[0.99] min-h-[56px] touch-target"
                          >
                            <input
                              type="checkbox"
                              checked={formData.serviceIds.includes(service.id)}
                              onChange={() => handleServiceToggle(service.id)}
                              className="rounded border-white/30 bg-white/10 text-primary focus:ring-primary"
                            />
                            <span className="flex-1 text-sm font-medium text-white">
                              {service.name}
                            </span>
                            <span className="text-xs text-gray-400">
                              {Math.round(service.price)} грн · {service.duration} хв
                            </span>
                          </label>
                        ))}
                      {services.filter((s) =>
                        s.name.toLowerCase().includes(serviceSearchQuery.trim().toLowerCase())
                      ).length === 0 && (
                        <p className="p-4 text-center text-sm text-gray-400">
                          {serviceSearchQuery.trim() ? 'Нічого не знайдено' : 'Немає послуг'}
                        </p>
                      )}
                    </div>
                    <div className="p-2 border-t border-white/10 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowServiceModal(false)}
                        className="w-full dashboard-btn-primary min-h-[40px] py-2 touch-target"
                      >
                        Готово
                      </button>
                    </div>
                  </div>
                </div>
              </ModalPortal>
      )}

            {/* Actions */}
            <div className={`flex flex-col sm:flex-row gap-1.5 sm:gap-2 ${embedded ? 'pt-0.5' : 'pt-2'}`}>
              <button
                type="submit"
                disabled={!canSubmit}
                className={embedded ? 'dashboard-btn-primary flex-1 min-h-[34px] py-1.5 text-sm rounded-md' : 'dashboard-btn-primary flex-1 min-h-[48px] touch-target'}
              >
                {isSubmitting ? 'Створення...' : 'Створити запис'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className={embedded ? 'dashboard-btn-secondary min-h-[32px] h-[32px] py-1.5 text-sm rounded-md' : 'dashboard-btn-secondary min-h-[48px] touch-target'}
              >
                Скасувати
              </button>
            </div>
    </form>
  )

  if (embedded) {
    return <div ref={formRef}>{formContent}</div>
  }

  return (
    <div ref={formRef}>
      <Card className="card-candy">
        <CardHeader>
          <CardTitle className="text-subheading">Створити новий запис</CardTitle>
        </CardHeader>
        <CardContent>
          {formContent}
        </CardContent>
      </Card>
    </div>
  )
}
