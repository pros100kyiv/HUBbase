'use client'

import { useEffect, useState } from 'react'
import { useBooking, Service } from '@/contexts/BookingContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ServiceStepProps {
  businessId?: string
}

export function ServiceStep({ businessId }: ServiceStepProps) {
  const { state, addService, removeService, setCustomService, setStep } = useBooking()
  const [services, setServices] = useState<Service[]>([])
  const [showCustomService, setShowCustomService] = useState(false)

  useEffect(() => {
    if (!businessId) return
    fetch(`/api/services?businessId=${businessId}`)
      .then(res => res.json())
      .then(data => setServices(data))
  }, [businessId])

  const isSelected = (serviceId: string) => {
    return state.selectedServices.some(s => s.id === serviceId)
  }

  const toggleService = (service: Service) => {
    if (isSelected(service.id)) {
      removeService(service.id)
    } else {
      addService(service)
    }
  }

  const totalPrice = state.selectedServices.reduce((sum, s) => sum + s.price, 0)
  const totalDuration = state.selectedServices.reduce((sum, s) => sum + s.duration, 0)
  const hasSelection = state.selectedServices.length > 0 || state.customService.trim().length > 0

  return (
    <div className="min-h-screen bg-gray-900 dark:bg-gray-950 py-6 px-3">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-black mb-4 text-center text-white">
          ОБЕРІТЬ ПОСЛУГУ
        </h2>
        
        {/* Кнопка для кастомної послуги */}
        <div className="mb-3">
          <button
            onClick={() => {
              setShowCustomService(!showCustomService)
              if (showCustomService) {
                setCustomService('')
              }
            }}
            className="w-full p-2 text-sm text-white/80 hover:text-white border border-white/20 hover:border-white/40 rounded-candy-sm transition-all"
          >
            {showCustomService ? '✕ Скасувати' : '+ Вказати свою послугу'}
          </button>
        </div>
        
        {/* Поле для кастомної послуги */}
        {showCustomService && (
          <div className="mb-4 p-3 bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-candy-sm">
            <label className="block text-sm font-bold mb-2 text-white">
              Опишіть послугу, яку вам потрібно:
            </label>
            <textarea
              value={state.customService}
              onChange={(e) => setCustomService(e.target.value)}
              placeholder="Наприклад: Стрижка + укладка, Фарбування волосся, тощо..."
              className="w-full px-3 py-2 text-sm rounded-candy-sm border border-white/20 bg-white/10 dark:bg-white/5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
            />
            {state.customService.trim().length > 0 && (
              <p className="text-xs text-white/70 mt-2">
                💡 Ця послуга буде відображена спеціалісту при підтвердженні візиту
              </p>
            )}
          </div>
        )}

        <div className="space-y-2 mb-4">
          {services.map((service) => (
            <div
              key={service.id}
              className={`bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-candy-sm p-3 cursor-pointer transition-all hover:bg-white/15 dark:hover:bg-white/10 ${
                isSelected(service.id) ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-white/20 dark:bg-white/15' : ''
              }`}
              onClick={() => toggleService(service)}
            >
              <div className="flex justify-between items-center">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black mb-1 truncate text-white">{service.name}</h3>
                  {service.category && (
                    <p className="text-xs text-white/70">{service.category}</p>
                  )}
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <p className="text-base font-black text-white">{service.price} ₴</p>
                  <p className="text-[10px] text-white/60">{service.duration} хв</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {(state.selectedServices.length > 0 || state.customService.trim().length > 0) && (
          <div className="bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-candy-sm p-3 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-white">Всього:</span>
              <div className="text-right">
                <p className="text-lg font-black text-white">{totalPrice} ₴</p>
                {totalDuration > 0 && (
                  <p className="text-[10px] text-white/60">{totalDuration} хв</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              {state.selectedServices.map((service) => (
                <div key={service.id} className="flex justify-between text-xs">
                  <span className="text-white/80">{service.name}</span>
                  <span className="text-white font-bold">{service.price} ₴</span>
                </div>
              ))}
              {state.customService.trim().length > 0 && (
                <div className="flex justify-between text-xs pt-1 border-t border-white/20">
                  <span className="text-white/80 italic">{state.customService}</span>
                  <span className="text-white/60 text-[10px]">(уточнити)</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(0)} className="btn-secondary flex-1">
            Назад
          </Button>
          <Button
            onClick={() => setStep(2)}
            disabled={!hasSelection}
            className="btn-primary flex-1"
          >
            Далі
          </Button>
        </div>
      </div>
    </div>
  )
}

