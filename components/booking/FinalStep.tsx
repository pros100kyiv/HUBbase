'use client'

import { useState } from 'react'
import { useBooking } from '@/contexts/BookingContext'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface FinalStepProps {
  businessId?: string
}

export function FinalStep({ businessId }: FinalStepProps) {
  const { state, setClientName, setClientPhone, setStep, reset } = useBooking()
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validate = () => {
    const newErrors: { name?: string; phone?: string } = {}

    if (!state.clientName.trim()) {
      newErrors.name = "Ім'я обов'язкове"
    }

    if (!state.clientPhone.trim()) {
      newErrors.phone = 'Телефон обов\'язковий'
    } else if (!state.clientPhone.startsWith('+380')) {
      newErrors.phone = 'Телефон повинен починатися з +380'
    } else if (state.clientPhone.length !== 13) {
      newErrors.phone = 'Невірний формат телефону'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setIsSubmitting(true)

    try {
      const totalDuration = state.selectedServices.reduce((sum, s) => sum + s.duration, 0)
      const [hours, minutes] = state.selectedTime!.split(':').map(Number)
      const startTime = new Date(state.selectedDate!)
      startTime.setHours(hours, minutes, 0, 0)
      const endTime = new Date(startTime.getTime() + totalDuration * 60000)

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: businessId || state.businessId,
          masterId: state.selectedMaster!.id,
          clientName: state.clientName,
          clientPhone: state.clientPhone,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          services: state.selectedServices.map(s => s.id),
        }),
      })

      if (response.ok) {
        reset()
        const confirmed = window.confirm('Запис успішно створено! Хочете створити ще один?')
        if (confirmed) {
          setStep(0)
        } else {
          // Повертаємося на головну
          if (typeof window !== 'undefined') {
            window.location.href = '/'
          }
        }
      } else {
        const data = await response.json()
        alert(data.error || 'Помилка при створенні запису')
      }
    } catch (error) {
      alert('Помилка при створенні запису')
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalPrice = state.selectedServices.reduce((sum, s) => sum + s.price, 0)

  return (
    <div className="min-h-screen py-4 sm:py-6 px-3 md:px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 text-center text-white" style={{ letterSpacing: '-0.02em' }}>
          Контактні дані
        </h2>

        <div className="rounded-xl p-3 sm:p-4 mb-4 card-floating">
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
                placeholder="+380XXXXXXXXX"
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

        <div className="rounded-xl p-4 mb-4 card-floating">
          <h3 className="text-base font-semibold mb-3 text-white">Деталі запису:</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Майстер:</span><span className="font-medium text-white">{state.selectedMaster?.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Дата та час:</span><span className="font-medium text-white">{state.selectedDate && format(state.selectedDate, 'd MMMM yyyy', { locale: uk })}, {state.selectedTime}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Послуги:</span><span className="font-medium text-white text-right max-w-[60%]">{state.selectedServices.map(s => s.name).join(', ')}</span></div>
            <div className="flex justify-between pt-2 border-t border-white/10"><span className="font-semibold text-white">Всього:</span><span className="text-lg font-bold text-white">{Math.round(totalPrice)} ₴</span></div>
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3">
          <button type="button" onClick={() => setStep(3)} className="touch-target flex-1 min-h-[48px] py-2.5 rounded-lg border border-white/20 bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors active:scale-[0.98]">Назад</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="touch-target flex-1 min-h-[48px] py-2.5 rounded-lg bg-white text-black text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
          >
            {isSubmitting ? 'Відправка...' : 'Підтвердити запис'}
          </button>
        </div>
      </div>
    </div>
  )
}

