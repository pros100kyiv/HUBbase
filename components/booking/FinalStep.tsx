'use client'

import { useState } from 'react'
import { useBooking } from '@/contexts/BookingContext'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { isValidUaPhone } from '@/lib/utils/phone'
import { toast } from '@/components/ui/toast'
import { ModalPortal } from '@/components/ui/modal-portal'

interface FinalStepProps {
  businessId?: string
}

export function FinalStep({ businessId }: FinalStepProps) {
  const { state, setClientName, setClientPhone, setStep, reset } = useBooking()
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  const validate = () => {
    const newErrors: { name?: string; phone?: string } = {}

    if (!state.clientName.trim()) {
      newErrors.name = "Ім'я обов'язкове"
    }

    if (!state.clientPhone.trim()) {
      newErrors.phone = 'Телефон обов\'язковий'
    } else if (!isValidUaPhone(state.clientPhone)) {
      newErrors.phone = 'Введіть номер з 0, наприклад 0671234567'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    setSubmitError(null)
    if (!validate()) return
    if (!state.selectedDate || !state.selectedTime) {
      toast({ title: 'Оберіть дату та час запису', type: 'error' })
      return
    }
    const bid = businessId || state.businessId
    if (!bid) {
      toast({ title: 'Помилка', description: 'Бізнес не визначено. Оновіть сторінку та спробуйте знову.', type: 'error' })
      return
    }
    if (!state.selectedMaster?.id) {
      toast({ title: 'Помилка', description: 'Спеціаліст не обрано. Поверніться назад та оберіть спеціаліста.', type: 'error' })
      return
    }

    setIsSubmitting(true)

    try {
      const totalDurationFromServices = state.selectedServices.reduce((sum, s) => sum + s.duration, 0)
      const totalDuration = totalDurationFromServices > 0 ? totalDurationFromServices : 30
      const [hours, minutes] = state.selectedTime.split(':').map(Number)
      const dateStr = format(state.selectedDate!, 'yyyy-MM-dd')
      const slotKey = `${dateStr}T${state.selectedTime}`

      // Keep legacy ISO payload for backward compatibility, but primary source is `slotKey`.
      const startTime = new Date(state.selectedDate!)
      startTime.setHours(hours, minutes, 0, 0)
      const endTime = new Date(startTime.getTime() + totalDuration * 60000)

      const isWithoutService = state.bookingWithoutService || (state.customServiceName && state.customServiceName.trim().length > 0)
      const servicesPayload = isWithoutService ? [] : state.selectedServices.map(s => s.id)
      const customServiceNamePayload = state.customServiceName?.trim() || null

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: bid,
          masterId: state.selectedMaster.id,
          clientName: state.clientName,
          clientPhone: state.clientPhone,
          slot: slotKey,
          durationMinutes: totalDuration,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          services: servicesPayload,
          ...(customServiceNamePayload && { customServiceName: customServiceNamePayload }),
          isFromBooking: true,
        }),
      })

      if (response.ok) {
        reset()
        toast({ title: 'Запис створено!', description: 'Ми чекаємо на вас.', type: 'success', duration: 4000 })
        setShowSuccessModal(true)
      } else {
        let msg = 'Помилка при створенні запису'
        let isSlotTaken = false
        try {
          const text = await response.text()
          if (text) {
            const data = JSON.parse(text)
            msg = data.error || msg
            isSlotTaken = response.status === 409 || /already booked|зайнят/i.test(msg)
          }
        } catch {
          // ignore
        }
        if (isSlotTaken || response.status === 409) {
          const slotTakenMsg = 'Цей час уже зайнятий іншим клієнтом. Поверніться та оберіть інший час.'
          setSubmitError(slotTakenMsg)
          toast({ title: 'Час зайнятий', description: slotTakenMsg, type: 'error', duration: 5000 })
        } else {
          toast({ title: 'Помилка', description: msg, type: 'error' })
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Помилка при створенні запису'
      toast({ title: 'Помилка', description: errMsg, type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalPrice = state.selectedServices.reduce((sum, s) => sum + s.price, 0)
  const isPriceAfterProcedure = state.bookingWithoutService || (state.customServiceName && state.customServiceName.trim().length > 0)

  return (
    <div className="min-h-screen py-4 sm:py-6 px-3 md:px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 text-center text-white" style={{ letterSpacing: '-0.02em' }}>
          Контактні дані
        </h2>

        <div className="rounded-xl p-3 sm:p-4 mb-4 card-glass">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-300">Ім'я *</label>
              <input
                value={state.clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ваше ім'я"
                className={cn(
                  'w-full px-4 py-3 sm:py-2.5 rounded-lg border text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 min-h-[48px] sm:min-h-0',
                  errors.name ? 'border-red-500 bg-red-500/10' : 'border-white/20 bg-white/10 focus:bg-white/15'
                )}
              />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-300">Телефон *</label>
              <input
                value={state.clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="0XX XXX XX XX"
                type="tel"
                className={cn(
                  'w-full px-4 py-3 sm:py-2.5 rounded-lg border text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 min-h-[48px] sm:min-h-0',
                  errors.phone ? 'border-red-500 bg-red-500/10' : 'border-white/20 bg-white/10 focus:bg-white/15'
                )}
              />
              {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
            </div>
          </div>
        </div>

        {submitError && (
          <div className="rounded-xl p-4 mb-4 card-glass border-2 border-amber-500/50 bg-amber-500/10">
            <p className="text-sm font-medium text-amber-200 mb-3">{submitError}</p>
            <button
              type="button"
              onClick={() => { setSubmitError(null); setStep(3) }}
              className="w-full min-h-[44px] py-2.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-100 text-sm font-semibold hover:bg-amber-500/30 transition-colors"
            >
              ← Назад до вибору часу
            </button>
          </div>
        )}

        <div className="rounded-xl p-4 mb-4 card-glass">
          <h3 className="text-base font-semibold mb-3 text-white">Деталі запису:</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Спеціаліст:</span><span className="font-medium text-white">{state.selectedMaster?.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Дата та час:</span><span className="font-medium text-white">{state.selectedDate && format(state.selectedDate, 'd MMMM yyyy', { locale: uk })}, {state.selectedTime}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Послуги:</span><span className="font-medium text-white text-right max-w-[60%]">
              {isPriceAfterProcedure
                ? (state.customServiceName?.trim() ? state.customServiceName.trim() : 'Без послуги — вартість після процедури')
                : state.selectedServices.map(s => s.name).join(', ')}
            </span></div>
            <div className="flex justify-between pt-2 border-t border-white/10"><span className="font-semibold text-white">Всього:</span><span className="text-lg font-bold text-purple-400">{isPriceAfterProcedure ? 'Вартість узгоджується після процедури' : `${Math.round(totalPrice)} ₴`}</span></div>
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3">
          <button type="button" onClick={() => setStep(3)} className="touch-target flex-1 min-h-[48px] py-2.5 rounded-lg border border-white/20 bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors active:scale-[0.98]">Назад</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !state.selectedDate || !state.selectedTime}
            className="touch-target flex-1 min-h-[48px] py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.25)' }}
          >
            {isSubmitting ? 'Відправка...' : 'Підтвердити запис'}
          </button>
        </div>
      </div>

      {/* Модалка після успішного створення запису */}
      {showSuccessModal && typeof document !== 'undefined' && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowSuccessModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-modal-title"
          >
            <div
              className="w-full max-w-sm rounded-2xl p-6 bg-white/10 border border-white/20 shadow-xl text-white text-center animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-500/30 border border-emerald-400/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 id="success-modal-title" className="text-xl font-bold mb-2">Ваш запис створено!</h2>
              <p className="text-sm text-gray-300 mb-6">Ми чекаємо на вас. Хочете записатися ще на одну послугу?</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => { setShowSuccessModal(false); setStep(0) }}
                  className="flex-1 min-h-[48px] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors active:scale-[0.98]"
                >
                  Так, створити ще один запис
                </button>
                <button
                  type="button"
                  onClick={() => { setShowSuccessModal(false); if (typeof window !== 'undefined') window.location.href = '/' }}
                  className="flex-1 min-h-[48px] py-2.5 rounded-xl border border-white/20 bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors active:scale-[0.98]"
                >
                  Готово
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  )
}

