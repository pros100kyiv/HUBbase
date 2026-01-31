'use client'

import { useState } from 'react'
import { useBooking } from '@/contexts/BookingContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'

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
    <div className="min-h-screen bg-gray-900 dark:bg-gray-950 py-6 px-3">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-black mb-4 text-center text-white">
          КОНТАКТНІ ДАНІ
        </h2>

        <div className="bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-candy-sm p-3 mb-3">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-bold mb-1.5 text-white">Ім&apos;я *</label>
              <Input
                value={state.clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ваше ім'я"
                className={`text-sm bg-white/10 dark:bg-white/5 border-white/20 text-white placeholder:text-white/50 ${errors.name ? 'border-red-500' : ''}`}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold mb-1.5 text-white">Телефон *</label>
              <Input
                value={state.clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+380XXXXXXXXX"
                className={`text-sm bg-white/10 dark:bg-white/5 border-white/20 text-white placeholder:text-white/50 ${errors.phone ? 'border-red-500' : ''}`}
              />
              {errors.phone && (
                <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-candy-sm p-3 mb-4">
          <h3 className="text-base font-black mb-3 text-white">Деталі запису:</h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-white/70">Майстер:</span>
              <span className="font-bold text-white">{state.selectedMaster?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Дата та час:</span>
              <span className="font-bold text-white">
                {state.selectedDate &&
                  format(state.selectedDate, 'd MMMM yyyy', { locale: uk })}
                , {state.selectedTime}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Послуги:</span>
              <span className="font-bold text-white text-right max-w-[60%]">{state.selectedServices.map(s => s.name).join(', ')}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-white/20">
              <span className="font-bold text-white">Всього:</span>
              <span className="text-lg font-black text-white">{totalPrice} ₴</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(3)} className="btn-secondary flex-1">
            Назад
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-primary flex-1"
          >
            {isSubmitting ? 'Відправка...' : 'Підтвердити запис'}
          </Button>
        </div>
      </div>
    </div>
  )
}

