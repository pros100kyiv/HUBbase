'use client'

import { useEffect, useState } from 'react'
import { useBooking, Service } from '@/contexts/BookingContext'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { toast } from '@/components/ui/toast'

interface ServiceStepProps {
  businessId?: string
}

const DEFAULT_DURATION_NO_SERVICE = 30

export function ServiceStep({ businessId }: ServiceStepProps) {
  const { state, addService, removeService, setStep, setBookingWithoutService, setCustomServiceName } = useBooking()
  const [services, setServices] = useState<Service[]>([])
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'catalog' | 'without' | 'custom'>('catalog')

  useEffect(() => {
    if (!businessId) return
    fetch(`/api/services?businessId=${businessId}`)
      .then(res => (res.ok ? res.json() : []))
      .then(data => setServices(Array.isArray(data) ? data : []))
      .catch(() => setServices([]))
  }, [businessId])

  // Keep UI mode in sync with booking state (back/forward navigation).
  useEffect(() => {
    if (state.bookingWithoutService) {
      setMode('without')
      return
    }
    if (state.customServiceName && state.customServiceName.trim()) {
      setMode('custom')
      return
    }
    setMode('catalog')
  }, [state.bookingWithoutService, state.customServiceName])

  const isSelected = (serviceId: string) => state.selectedServices.some(s => s.id === serviceId)
  const toggleService = (service: Service) => {
    setMode('catalog')
    setBookingWithoutService(false)
    setCustomServiceName('')
    if (isSelected(service.id)) removeService(service.id)
    else addService(service)
  }

  const handleWithoutService = () => {
    setMode('without')
    setBookingWithoutService(true)
    setCustomServiceName('')
    state.selectedServices.forEach(s => removeService(s.id))
  }

  const handleCustomServiceFocus = () => {
    setMode('custom')
    setBookingWithoutService(false)
    state.selectedServices.forEach(s => removeService(s.id))
  }

  const handleModeChange = (next: typeof mode) => {
    setMode(next)
    if (next === 'without') {
      handleWithoutService()
      return
    }
    if (next === 'custom') {
      setBookingWithoutService(false)
      state.selectedServices.forEach((s) => removeService(s.id))
      return
    }
    // catalog
    setBookingWithoutService(false)
    setCustomServiceName('')
  }

  const canProceed =
    state.selectedServices.length > 0 ||
    state.bookingWithoutService ||
    (state.customServiceName && state.customServiceName.trim().length > 0)

  const totalPrice = state.selectedServices.reduce((sum, s) => sum + s.price, 0)
  const totalDuration = state.selectedServices.reduce((sum, s) => sum + s.duration, 0)

  const handleProceed = async () => {
    // Flow safety: this step comes after choosing master + time.
    if (!state.selectedMaster?.id) {
      toast({ title: 'Оберіть спеціаліста', type: 'error' })
      setStep(1)
      return
    }
    if (!state.selectedDate || !state.selectedTime) {
      toast({ title: 'Оберіть дату та час', type: 'error' })
      setStep(2)
      return
    }
    const bid = businessId || state.businessId
    if (!bid) {
      toast({ title: 'Помилка', description: 'Бізнес не визначено. Оновіть сторінку.', type: 'error' })
      setStep(0)
      return
    }

    // If services/custom change duration after the time was chosen, revalidate the slot.
    const isWithoutService =
      state.bookingWithoutService || (state.customServiceName && state.customServiceName.trim().length > 0)
    const durationMinutes = isWithoutService
      ? DEFAULT_DURATION_NO_SERVICE
      : (totalDuration > 0 ? totalDuration : DEFAULT_DURATION_NO_SERVICE)

    try {
      const dateStr = format(state.selectedDate, 'yyyy-MM-dd')
      const params = new URLSearchParams({
        masterId: state.selectedMaster.id,
        businessId: bid,
        date: dateStr,
        durationMinutes: String(durationMinutes),
      })
      const res = await fetch(`/api/availability?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        const available = Array.isArray(data?.availableSlots) ? data.availableSlots : []
        const key = `${dateStr}T${state.selectedTime}`
        if (available.length > 0 && !available.includes(key)) {
          toast({
            title: 'Час недоступний',
            description: 'Обраний час більше не підходить під тривалість. Оберіть інший час.',
            type: 'error',
            duration: 5000,
          })
          setStep(2)
          return
        }
      }
    } catch {
      // If validation fails (network), still allow proceeding; server will reject conflicts.
    }

    setStep(4)
  }

  const filteredServices = services.filter((s) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const name = String(s?.name || '').toLowerCase()
    const cat = String((s as any)?.category || '').toLowerCase()
    return name.includes(q) || cat.includes(q)
  })

  return (
    <div className="min-h-screen py-4 sm:py-6 px-3 md:px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 text-center text-foreground" style={{ letterSpacing: '-0.02em' }}>
          Виберіть послугу
        </h2>

        {/* Mode selector (reduces visual overload) */}
        <div className="mb-4">
          <div className="grid grid-cols-3 gap-2 rounded-xl p-2 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10">
            <button
              type="button"
              onClick={() => handleModeChange('catalog')}
              className={cn(
                'min-h-[40px] rounded-lg text-xs font-semibold transition-colors',
                mode === 'catalog'
                  ? 'bg-white text-black shadow-sm'
                  : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/10'
              )}
            >
              Каталог
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('without')}
              className={cn(
                'min-h-[40px] rounded-lg text-xs font-semibold transition-colors',
                mode === 'without'
                  ? 'bg-white text-black shadow-sm'
                  : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/10'
              )}
            >
              Без послуги
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('custom')}
              className={cn(
                'min-h-[40px] rounded-lg text-xs font-semibold transition-colors',
                mode === 'custom'
                  ? 'bg-white text-black shadow-sm'
                  : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/10'
              )}
            >
              Своя
            </button>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            Оберіть з каталогу або вкажіть варіант без послуги/свою назву.
          </p>
        </div>

        {mode === 'without' && (
          <div
            role="button"
            tabIndex={0}
            onClick={handleWithoutService}
            onKeyDown={(e) => e.key === 'Enter' && handleWithoutService()}
            className={cn(
              'rounded-xl p-4 mb-5 bg-black/[0.04] dark:bg-white/10 border border-black/10 dark:border-white/15 cursor-pointer transition-all hover:bg-black/[0.06] dark:hover:bg-white/[0.14] active:scale-[0.99] outline-none',
              state.bookingWithoutService && 'ring-2 ring-black/20 dark:ring-white/40 border-black/20 dark:border-white/25 bg-black/[0.06] dark:bg-white/[0.14]'
            )}
          >
            <h3 className="text-sm sm:text-base font-bold text-foreground">Записатися без послуги</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Ви зможете узгодити вартість після процедури. Тривалість слота за замовчуванням: {DEFAULT_DURATION_NO_SERVICE} хв.
            </p>
          </div>
        )}

        {mode === 'custom' && (
          <div className={cn(
            'rounded-xl p-4 mb-5 bg-black/[0.04] dark:bg-white/10 border border-black/10 dark:border-white/15 transition-all outline-none',
            state.customServiceName.trim() && 'ring-2 ring-black/20 dark:ring-white/40 border-black/20 dark:border-white/25 bg-black/[0.06] dark:bg-white/[0.14]'
          )}>
            <p className="text-sm font-semibold text-foreground mb-2">Вкажіть свою послугу</p>
            <input
              type="text"
              value={state.customServiceName}
              onChange={(e) => setCustomServiceName(e.target.value)}
              onFocus={handleCustomServiceFocus}
              placeholder="Наприклад: консультація, масаж спини..."
              className="w-full px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.03] dark:bg-white/10 text-foreground dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/30 focus:bg-black/[0.05] dark:focus:bg-white/[0.14] text-sm"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">Вартість визначиться після процедури</p>
          </div>
        )}

        {mode === 'catalog' && (
          <>
            <div className="mb-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Пошук послуги..."
                className="w-full px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.03] dark:bg-white/10 text-foreground dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/30 text-sm"
              />
            </div>
            <div className="space-y-2 mb-5">
              {filteredServices.length === 0 ? (
                <div className="rounded-xl p-4 border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/5">
                  <p className="text-sm font-semibold text-foreground">Нічого не знайдено</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Спробуйте інший запит або оберіть “Своя”.</p>
                </div>
              ) : (
                filteredServices.map((service) => (
                  <div
                    key={service.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleService(service)}
                    onKeyDown={(e) => e.key === 'Enter' && toggleService(service)}
                    className={cn(
                      'rounded-xl p-4 bg-black/[0.03] dark:bg-white/[0.07] border border-black/10 dark:border-white/10 cursor-pointer transition-all hover:bg-black/[0.05] dark:hover:bg-white/[0.10] active:scale-[0.99] min-h-[64px] touch-target flex items-center outline-none',
                      isSelected(service.id) && 'ring-2 ring-black/20 dark:ring-white/40 bg-black/[0.06] dark:bg-white/[0.12] border-black/20 dark:border-white/20'
                    )}
                  >
                    <div className="flex justify-between items-center w-full gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm sm:text-base font-bold truncate text-foreground">{service.name}</h3>
                        {service.category && <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-0.5">{service.category}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-purple-400">{Math.round(service.price)} ₴</p>
                        <p className="text-xs text-purple-400/90">{service.duration} хв</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {state.selectedServices.length > 0 && (
          <div className="rounded-xl p-4 mb-4 bg-black/[0.04] dark:bg-white/10 border border-black/10 dark:border-white/15">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Всього:</span>
              <div className="text-right">
                <p className="text-lg font-bold text-purple-400">{Math.round(totalPrice)} ₴</p>
                <p className="text-xs text-purple-400/90">{totalDuration} хв</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {state.selectedServices.map((service) => (
                <div key={service.id} className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{service.name}</span>
                  <span className="text-purple-400 font-medium">{Math.round(service.price)} ₴</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(state.bookingWithoutService || state.customServiceName.trim()) && mode !== 'without' && (
          <div className="rounded-xl p-4 mb-4 bg-black/[0.04] dark:bg-white/10 border border-black/10 dark:border-white/15">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {state.bookingWithoutService ? 'Запис без послуги — вартість узгоджується після процедури.' : `Своя послуга: «${state.customServiceName.trim()}» — вартість після процедури.`}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Тривалість слота: {DEFAULT_DURATION_NO_SERVICE} хв (можна змінити в кабінеті)</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="touch-target flex-1 min-h-[52px] py-3 rounded-xl bg-black/[0.04] dark:bg-white/10 border border-black/10 dark:border-white/15 text-foreground dark:text-white text-sm font-semibold hover:bg-black/[0.06] dark:hover:bg-white/20 transition-colors active:scale-[0.98] outline-none"
          >
            Назад
          </button>
          <button
            type="button"
            onClick={handleProceed}
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

