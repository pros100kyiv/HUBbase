'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format, isValid } from 'date-fns'
import { toast } from '@/components/ui/toast'
import { ModalPortal } from '@/components/ui/modal-portal'
import { normalizeUaPhone } from '@/lib/utils/phone'

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
  /** Початковий майстер (ID), наприклад з «Вільні години» */
  initialMasterId?: string
  onSuccess: () => void
  onCancel: () => void
  /** У модальному вікні — без Card і заголовка */
  embedded?: boolean
  /** Початкові дані клієнта (наприклад після пошуку за телефоном або створення картки) */
  initialClientName?: string
  initialClientPhone?: string
  /** Клієнт уже обраний (перехід з картки клієнта) — не показувати поля телефону/імені, тільки дата, час, майстер, послуги */
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
    <form onSubmit={handleSubmit} className={embedded ? 'space-y-1.5' : 'space-y-4'}>
            {/* Master Selection */}
            <div>
              <label className={`block font-medium text-foreground ${embedded ? 'text-xs mb-0.5' : 'text-sm mb-2'}`}>
                Спеціаліст *
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

            {/* Клієнт: або заблокований (перехід з картки — не показувати поля телефону/імені), або поля для вводу */}
            {clientLocked && formData.clientPhone?.replace(/\D/g, '').length >= 9 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-medium text-gray-500 mb-0.5">Клієнт</p>
                <p className="text-sm font-semibold text-white">{formData.clientName?.trim() || '—'}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formData.clientPhone}</p>
              </div>
            ) : (
              <>
                <div>
                  <label className={`block font-medium text-foreground ${embedded ? 'text-xs mb-0.5' : 'text-sm mb-2'}`}>
                    Ім'я клієнта *
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
                    Телефон клієнта *
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
                    {formData.clientPhone.replace(/\D/g, '').length >= 9 && (
                      <a
                        href={`/dashboard/clients?phone=${encodeURIComponent(normalizeUaPhone(formData.clientPhone))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                      >
                        Картка клієнта
                      </a>
                    )}
                  </div>
                  {clientLookupStatus === 'loading' && (
                    <p className="text-xs text-muted-foreground mt-0.5">Пошук клієнта…</p>
                  )}
                  {clientLookupStatus === 'found' && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Клієнт знайдено в базі</p>
                  )}
                  {clientLookupStatus === 'not_found' && formData.clientPhone.replace(/\D/g, '').length >= 9 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Новий клієнт — введіть ім'я</p>
                  )}
                </div>
              </>
            )}

            {/* Services */}
            <div>
              <label className={`block font-medium text-foreground ${embedded ? 'text-xs mb-0.5' : 'text-sm mb-2'}`}>
                Послуги (опціонально)
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
                      className="inline-flex items-center justify-center gap-1 min-h-[32px] h-[32px] px-2.5 py-1.5 text-xs font-medium rounded-md border border-white/20 bg-white/5 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 touch-manipulation w-full sm:w-auto sm:max-w-[160px]"
                    >
                      {showServiceModal ? 'Приховати послуги' : 'Обрати послуги'}
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

            {/* Custom Service */}
            <div>
              <label className={`block font-medium text-foreground ${embedded ? 'text-xs mb-0.5' : 'text-sm mb-2'}`}>
                Додаткова послуга (опціонально)
              </label>
              <div className="flex gap-2">
                <Input
                  value={formData.customService}
                  onChange={(e) => setFormData({ ...formData, customService: e.target.value })}
                  placeholder="Назва послуги"
                  className={embedded ? `flex-1 min-w-0 ${embeddedFieldClass}` : 'flex-1'}
                />
                <Input
                  type="number"
                  value={formData.customPrice}
                  onChange={(e) => setFormData({ ...formData, customPrice: Number(e.target.value) })}
                  placeholder="Ціна"
                  min="0"
                  className={embedded ? `w-16 min-w-[4rem] shrink-0 ${embeddedFieldBase}` : 'w-24'}
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className={`block font-medium text-foreground ${embedded ? 'text-xs mb-0.5' : 'text-sm mb-2'}`}>
                Дата *
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

            {/* Start Time */}
            <div>
              <label className={`block font-medium text-foreground ${embedded ? 'text-xs mb-0.5' : 'text-sm mb-2'}`}>
                Час початку *
              </label>
              <Input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
                className={embedded ? embeddedFieldClass : undefined}
              />
            </div>

            {/* Actions */}
            <div className={`flex flex-col sm:flex-row gap-1.5 sm:gap-2 ${embedded ? 'pt-0.5' : 'pt-2'}`}>
              <button
                type="submit"
                disabled={isSubmitting || !formData.masterId || !formData.clientName || !formData.clientPhone}
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
