'use client'

import { useEffect, useState } from 'react'
import { useBooking, Service } from '@/contexts/BookingContext'
import { cn } from '@/lib/utils'

interface ServiceStepProps {
  businessId?: string
}

export function ServiceStep({ businessId }: ServiceStepProps) {
  const { state, addService, removeService, setStep } = useBooking()
  const [services, setServices] = useState<Service[]>([])

  useEffect(() => {
    if (!businessId) return
    fetch(`/api/services?businessId=${businessId}`)
      .then(res => res.json())
      .then(data => setServices(data))
  }, [businessId])

  const isSelected = (serviceId: string) => state.selectedServices.some(s => s.id === serviceId)
  const toggleService = (service: Service) => {
    if (isSelected(service.id)) removeService(service.id)
    else addService(service)
  }
  const totalPrice = state.selectedServices.reduce((sum, s) => sum + s.price, 0)
  const totalDuration = state.selectedServices.reduce((sum, s) => sum + s.duration, 0)

  return (
    <div className="min-h-screen py-4 sm:py-6 px-3 md:px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 text-center text-white" style={{ letterSpacing: '-0.02em' }}>
          Оберіть послугу
        </h2>

        <div className="space-y-2 sm:space-y-2 mb-4">
          {services.map((service) => (
            <div
              key={service.id}
              role="button"
              tabIndex={0}
              onClick={() => toggleService(service)}
              onKeyDown={(e) => e.key === 'Enter' && toggleService(service)}
              className={cn(
                'rounded-xl p-3 sm:p-4 card-floating cursor-pointer transition-all hover:bg-white/[0.08] active:scale-[0.99] min-h-[56px] touch-target flex items-center',
                isSelected(service.id) && 'ring-2 ring-white/50 bg-white/[0.12]'
              )}
            >
              <div className="flex justify-between items-center w-full gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-semibold mb-0.5 truncate text-white">{service.name}</h3>
                  {service.category && <p className="text-xs text-gray-400 truncate">{service.category}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm sm:text-base font-semibold text-white">{service.price} ₴</p>
                  <p className="text-xs text-gray-400">{service.duration} хв</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {state.selectedServices.length > 0 && (
          <div className="rounded-xl p-4 mb-4 card-floating">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-300">Всього:</span>
              <div className="text-right">
                <p className="text-lg font-bold text-white">{totalPrice} ₴</p>
                <p className="text-xs text-gray-400">{totalDuration} хв</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {state.selectedServices.map((service) => (
                <div key={service.id} className="flex justify-between text-sm">
                  <span className="text-gray-300">{service.name}</span>
                  <span className="text-white font-medium">{service.price} ₴</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 sm:gap-3">
          <button type="button" onClick={() => setStep(0)} className="touch-target flex-1 min-h-[48px] py-2.5 rounded-lg border border-white/20 bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors active:scale-[0.98]">
            Назад
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={state.selectedServices.length === 0}
            className="touch-target flex-1 min-h-[48px] py-2.5 rounded-lg bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
          >
            Далі
          </button>
        </div>
      </div>
    </div>
  )
}

