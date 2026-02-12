'use client'

import { useEffect, useState } from 'react'
import { useBooking, Service } from '@/contexts/BookingContext'
import { cn } from '@/lib/utils'

interface ServiceStepProps {
  businessId?: string
}

const DEFAULT_DURATION_NO_SERVICE = 30

export function ServiceStep({ businessId }: ServiceStepProps) {
  const { state, addService, removeService, setStep, setBookingWithoutService, setCustomServiceName } = useBooking()
  const [services, setServices] = useState<Service[]>([])

  useEffect(() => {
    if (!businessId) return
    fetch(`/api/services?businessId=${businessId}`)
      .then(res => (res.ok ? res.json() : []))
      .then(data => setServices(Array.isArray(data) ? data : []))
      .catch(() => setServices([]))
  }, [businessId])

  const isSelected = (serviceId: string) => state.selectedServices.some(s => s.id === serviceId)
  const toggleService = (service: Service) => {
    setBookingWithoutService(false)
    setCustomServiceName('')
    if (isSelected(service.id)) removeService(service.id)
    else addService(service)
  }

  const handleWithoutService = () => {
    setBookingWithoutService(true)
    setCustomServiceName('')
    state.selectedServices.forEach(s => removeService(s.id))
  }

  const handleCustomServiceFocus = () => {
    setBookingWithoutService(false)
    state.selectedServices.forEach(s => removeService(s.id))
  }

  const canProceed =
    state.selectedServices.length > 0 ||
    state.bookingWithoutService ||
    (state.customServiceName && state.customServiceName.trim().length > 0)

  const totalPrice = state.selectedServices.reduce((sum, s) => sum + s.price, 0)
  const totalDuration = state.selectedServices.reduce((sum, s) => sum + s.duration, 0)

  return (
    <div className="min-h-screen py-4 sm:py-6 px-3 md:px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 text-center text-white" style={{ letterSpacing: '-0.02em' }}>
          Виберіть послугу
        </h2>

        {/* Записатися без послуги — світло-сіра картка */}
        <div className="space-y-3 mb-5">
          <div
            role="button"
            tabIndex={0}
            onClick={handleWithoutService}
            onKeyDown={(e) => e.key === 'Enter' && handleWithoutService()}
            className={cn(
              'rounded-xl p-4 bg-white/10 border border-white/15 cursor-pointer transition-all hover:bg-white/[0.14] active:scale-[0.99] min-h-[64px] flex items-center outline-none',
              state.bookingWithoutService && 'ring-2 ring-white/40 border-white/25 bg-white/[0.14]'
            )}
          >
            <div className="flex-1">
              <h3 className="text-sm sm:text-base font-bold text-white">Записатися без послуги</h3>
              <p className="text-xs text-gray-400 mt-0.5">Вартість узгоджується після процедури</p>
            </div>
          </div>

          {/* Або вкажіть свою послугу — та сама світло-сіра панель */}
          <div className={cn(
            'rounded-xl p-4 bg-white/10 border border-white/15 min-h-[64px] transition-all outline-none',
            state.customServiceName.trim() && 'ring-2 ring-white/40 border-white/25 bg-white/[0.14]'
          )}>
            <p className="text-sm font-semibold text-white mb-2">Або вкажіть свою послугу</p>
            <input
              type="text"
              value={state.customServiceName}
              onChange={(e) => setCustomServiceName(e.target.value)}
              onFocus={handleCustomServiceFocus}
              placeholder="Наприклад: консультація, масаж спини..."
              className="w-full px-4 py-2.5 rounded-xl border border-white/15 bg-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/[0.14] text-sm"
            />
            <p className="text-xs text-gray-400 mt-1.5">Вартість визначиться після процедури</p>
          </div>
        </div>

        <p className="text-sm text-white mb-2">Або оберіть з каталогу:</p>
        <div className="space-y-2 mb-5">
          {services.map((service) => (
            <div
              key={service.id}
              role="button"
              tabIndex={0}
              onClick={() => toggleService(service)}
              onKeyDown={(e) => e.key === 'Enter' && toggleService(service)}
              className={cn(
                'rounded-xl p-4 bg-white/[0.07] border border-white/10 cursor-pointer transition-all hover:bg-white/[0.10] active:scale-[0.99] min-h-[64px] touch-target flex items-center outline-none',
                isSelected(service.id) && 'ring-2 ring-white/40 bg-white/[0.12] border-white/20'
              )}
            >
              <div className="flex justify-between items-center w-full gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-bold truncate text-white">{service.name}</h3>
                  {service.category && <p className="text-xs text-gray-400 truncate mt-0.5">{service.category}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-purple-400">{Math.round(service.price)} ₴</p>
                  <p className="text-xs text-purple-400/90">{service.duration} хв</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {state.selectedServices.length > 0 && (
          <div className="rounded-xl p-4 mb-4 bg-white/10 border border-white/15">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-300">Всього:</span>
              <div className="text-right">
                <p className="text-lg font-bold text-purple-400">{Math.round(totalPrice)} ₴</p>
                <p className="text-xs text-purple-400/90">{totalDuration} хв</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {state.selectedServices.map((service) => (
                <div key={service.id} className="flex justify-between text-sm">
                  <span className="text-gray-300">{service.name}</span>
                  <span className="text-purple-400 font-medium">{Math.round(service.price)} ₴</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(state.bookingWithoutService || state.customServiceName.trim()) && (
          <div className="rounded-xl p-4 mb-4 bg-white/10 border border-white/15">
            <p className="text-sm text-gray-300">
              {state.bookingWithoutService ? 'Запис без послуги — вартість узгоджується після процедури.' : `Своя послуга: «${state.customServiceName.trim()}» — вартість після процедури.`}
            </p>
            <p className="text-xs text-gray-400 mt-1">Тривалість слота: {DEFAULT_DURATION_NO_SERVICE} хв (можна змінити в кабінеті)</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep(0)}
            className="touch-target flex-1 min-h-[52px] py-3 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-semibold hover:bg-white/20 transition-colors active:scale-[0.98] outline-none"
          >
            Назад
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!canProceed}
            className="touch-target flex-1 min-h-[52px] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed outline-none"
            style={{ boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)' }}
          >
            Далі
          </button>
        </div>
      </div>
    </div>
  )
}

