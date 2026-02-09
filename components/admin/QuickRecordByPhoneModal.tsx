'use client'

import { useState, useCallback, useEffect } from 'react'
import { ModalPortal } from '@/components/ui/modal-portal'
import { CreateAppointmentForm } from '@/components/admin/CreateAppointmentForm'
import { QuickClientCard } from '@/components/admin/QuickClientCard'
import { normalizeUaPhone, isValidUaPhone } from '@/lib/utils/phone'

export type QuickRecordStep = 'phone' | 'quick_record' | 'new_client'

interface QuickRecordByPhoneModalProps {
  isOpen: boolean
  onClose: () => void
  businessId: string
  masters: Array<{ id: string; name: string }>
  services: Array<{ id: string; name: string; price: number; duration: number }>
  selectedDate?: Date
  /** Початковий час запису (HH:mm), наприклад з «Вільні години» */
  initialStartTime?: string
  /** Клієнт уже обраний (з картки клієнта) — пропускаємо крок телефону */
  initialClientPhone?: string
  initialClientName?: string
  initialClientId?: string
  onAppointmentCreated?: () => void
}

export function QuickRecordByPhoneModal({
  isOpen,
  onClose,
  businessId,
  masters,
  services,
  selectedDate,
  initialStartTime,
  initialClientPhone,
  initialClientName,
  initialClientId,
  onAppointmentCreated,
}: QuickRecordByPhoneModalProps) {
  const [step, setStep] = useState<QuickRecordStep>('phone')
  const [phone, setPhone] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [client, setClient] = useState<{ id: string; name: string; phone: string } | null>(null)

  // Якщо відкрили з картки клієнта — одразу показуємо форму запису з підставленим клієнтом
  useEffect(() => {
    if (!isOpen) return
    const phoneNorm = initialClientPhone?.trim()
    if (phoneNorm && phoneNorm.replace(/\D/g, '').length >= 9) {
      setClient({
        id: initialClientId || '',
        name: initialClientName?.trim() || '',
        phone: normalizeUaPhone(phoneNorm) || phoneNorm,
      })
      setStep('quick_record')
      setPhone(phoneNorm)
    } else {
      setStep('phone')
      setClient(null)
      setPhone('')
    }
  }, [isOpen, initialClientPhone, initialClientName, initialClientId])

  const handleClose = useCallback(() => {
    setStep('phone')
    setPhone('')
    setClient(null)
    setLookupError('')
    onClose()
  }, [onClose])

  const handlePhoneNext = async () => {
    const raw = phone.trim()
    const digitsOnly = raw.replace(/\D/g, '')
    if (digitsOnly.length < 9) {
      setLookupError('Введіть мінімум 9 цифр')
      return
    }
    const normalized = normalizeUaPhone(raw)
    if (!isValidUaPhone(raw)) {
      setLookupError('Невірний формат. Введіть номер з 0, наприклад 0671234567')
      return
    }
    setLookupError('')
    setLookupLoading(true)
    try {
      const res = await fetch(
        `/api/clients?businessId=${encodeURIComponent(businessId)}&phone=${encodeURIComponent(normalized)}`
      )
      if (!res.ok) {
        setStep('new_client')
        setClient(null)
        return
      }
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      if (list.length > 0 && list[0].name) {
        setClient({ id: list[0].id, name: list[0].name, phone: list[0].phone || normalized })
        setStep('quick_record')
      } else {
        setClient(null)
        setStep('new_client')
      }
    } catch {
      setLookupError('Помилка пошуку. Спробуйте ще раз.')
      setStep('phone')
    } finally {
      setLookupLoading(false)
    }
  }

  const handleNewClientSuccess = (createdClient: { id: string; name: string; phone: string } | any) => {
    setClient({
      id: createdClient.id,
      name: createdClient.name ?? '',
      phone: createdClient.phone ?? normalizeUaPhone(phone),
    })
    setStep('quick_record')
  }

  const handleNewClientCancel = () => {
    setStep('phone')
    setClient(null)
  }

  const handleBackToPhone = () => {
    setStep('phone')
    setClient(null)
    setLookupError('')
  }

  const handleAppointmentSuccess = () => {
    handleClose()
    onAppointmentCreated?.()
  }

  if (!isOpen) return null

  if (step === 'new_client') {
    return (
      <QuickClientCard
        businessId={businessId}
        initialPhone={phone.trim() ? normalizeUaPhone(phone.trim()) : ''}
        onSuccess={handleNewClientSuccess}
        onCancel={handleNewClientCancel}
      />
    )
  }

  return (
    <ModalPortal>
      <div className="modal-overlay sm:!p-4" onClick={handleClose} role="presentation">
        <div
          className="relative w-[95%] sm:w-full sm:max-w-lg sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleClose}
            className="modal-close touch-target"
            aria-label="Закрити"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 sm:px-5 pb-4 sm:pb-5 pt-1">
            {/* Крок 1: Номер телефону */}
            {step === 'phone' && (
              <div className="modal-dialog form text-left">
                <div className="flex items-center gap-3 mb-4">
                  <div className="modal-action-btn flex-shrink-0" aria-hidden>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="modal-title text-white mb-0.5">Записати</h2>
                    <p className="modal-subtitle text-gray-400">Введіть номер — знайдемо клієнта або створимо картку</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Номер телефону</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value)
                        if (lookupError) setLookupError('')
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handlePhoneNext()}
                      placeholder="0XX XXX XX XX"
                      className="w-full min-h-[44px] sm:min-h-[38px] px-3 py-2.5 text-sm rounded-xl border border-white/20 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 transition-colors"
                      autoFocus
                      disabled={lookupLoading}
                      autoComplete="tel"
                    />
                    {lookupError && (
                      <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
                        <span aria-hidden>⚠</span>
                        {lookupError}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="w-full sm:w-auto min-h-[44px] sm:min-h-[40px] px-4 rounded-xl border border-white/20 bg-white/5 text-white text-sm font-medium hover:bg-white/10 transition-colors touch-target"
                    >
                      Скасувати
                    </button>
                    <button
                      type="button"
                      onClick={handlePhoneNext}
                      disabled={lookupLoading || phone.replace(/\D/g, '').length < 9}
                      className="w-full sm:flex-1 min-h-[44px] sm:min-h-[40px] px-4 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none transition-colors shadow-sm"
                    >
                      {lookupLoading ? 'Пошук…' : 'Далі'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Крок 2: Швидкий запис (клієнт знайдений) */}
            {step === 'quick_record' && client && (
              <div className="modal-dialog form text-left">
                <div className="flex items-center justify-between gap-2 mb-3 pr-8">
                  <button
                    type="button"
                    onClick={handleBackToPhone}
                    className="text-xs font-medium text-gray-400 hover:text-white transition-colors flex items-center gap-1 -ml-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Інший номер
                  </button>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 mb-4">
                  <p className="text-xs font-medium text-gray-400 mb-0.5">Клієнт</p>
                  <p className="text-sm font-medium text-white">{client.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{client.phone}</p>
                </div>
                <h2 className="modal-title text-white mb-3 text-base">Деталі запису</h2>
                <CreateAppointmentForm
                  businessId={businessId}
                  masters={masters}
                  services={services}
                  selectedDate={selectedDate}
                  initialStartTime={initialStartTime}
                  onSuccess={handleAppointmentSuccess}
                  onCancel={handleClose}
                  embedded
                  initialClientName={client.name}
                  initialClientPhone={client.phone}
                  clientLocked={Boolean(initialClientPhone?.trim())}
                  inlineServicePicker
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
