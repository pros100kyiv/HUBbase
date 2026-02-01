'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, addMinutes } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Master {
  id: string
  name: string
  isActive?: boolean
}

interface Service {
  id: string
  name: string
  price: number
  duration: number
}

interface CreateAppointmentFormProps {
  businessId: string
  masters: Master[]
  services: Service[]
  selectedDate?: Date
  onSuccess: () => void
  onCancel: () => void
}

export function CreateAppointmentForm({
  businessId,
  masters,
  services,
  selectedDate,
  onSuccess,
  onCancel,
}: CreateAppointmentFormProps) {
  const formRef = useRef<HTMLDivElement>(null)
  const [formData, setFormData] = useState({
    masterId: '',
    serviceIds: [] as string[],
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    customPrice: '',
    notes: '',
    isRecurring: false,
    recurrenceType: 'weekly' as 'daily' | 'weekly' | 'monthly',
    daysOfWeek: [] as number[], // 0 = Неділя, 1 = Понеділок, ..., 6 = Субота
    recurrenceEndDate: '',
  })
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const loadAvailableSlots = useCallback(async () => {
    if (!formData.masterId || !formData.date) return

    setIsLoadingSlots(true)
    try {
      const response = await fetch(
        `/api/availability?masterId=${formData.masterId}&businessId=${businessId}&date=${formData.date}`
      )
      if (response.ok) {
        const data = await response.json()
        setAvailableSlots(data.availableSlots || [])
      }
    } catch (error) {
      console.error('Error loading available slots:', error)
    } finally {
      setIsLoadingSlots(false)
    }
  }, [formData.masterId, formData.date, businessId])

  // Load available slots when master and date change
  useEffect(() => {
    if (formData.masterId && formData.date) {
      loadAvailableSlots()
    } else {
      setAvailableSlots([])
    }
  }, [formData.masterId, formData.date, loadAvailableSlots])

  // Автоматична прокрутка до форми
  useEffect(() => {
    if (formRef.current) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [])

  const calculateDuration = () => {
    return services
      .filter((s) => formData.serviceIds.includes(s.id))
      .reduce((total, s) => total + s.duration, 0)
  }

  const calculateTotalPrice = () => {
    return services
      .filter((s) => formData.serviceIds.includes(s.id))
      .reduce((total, s) => total + s.price, 0)
  }

  const isTimeAvailable = (time: string) => {
    const slot = `${formData.date}T${time}`
    return availableSlots.includes(slot)
  }

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
    setErrors({})

    // Validation
    if (!formData.masterId) {
      setErrors({ masterId: 'Оберіть майстра' })
      return
    }
    if (formData.serviceIds.length === 0) {
      setErrors({ services: 'Оберіть хоча б одну послугу' })
      return
    }
    if (!formData.clientName.trim()) {
      setErrors({ clientName: 'Введіть ім\'я клієнта' })
      return
    }
    if (!formData.clientPhone.trim()) {
      setErrors({ clientPhone: 'Введіть телефон клієнта' })
      return
    }
    if (!formData.date || !formData.time) {
      setErrors({ time: 'Оберіть дату та час' })
      return
    }
    if (formData.isRecurring) {
      if (formData.recurrenceType === 'weekly' && formData.daysOfWeek.length === 0) {
        setErrors({ recurrence: 'Оберіть хоча б один день тижня' })
        return
      }
      if (!formData.recurrenceEndDate) {
        setErrors({ recurrence: 'Вкажіть дату закінчення циклу' })
        return
      }
    }

    const duration = calculateDuration()
    const startTime = new Date(`${formData.date}T${formData.time}`)
    const endTime = addMinutes(startTime, duration)

    // Check if time is available
    if (!isTimeAvailable(formData.time)) {
      setErrors({ time: 'Цей час недоступний' })
      return
    }

    setIsLoading(true)
    try {
      const recurrencePattern = formData.isRecurring ? {
        type: formData.recurrenceType,
        daysOfWeek: formData.recurrenceType === 'weekly' ? formData.daysOfWeek : undefined,
      } : undefined

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          masterId: formData.masterId,
          clientName: formData.clientName.trim(),
          clientPhone: formData.clientPhone.trim(),
          clientEmail: formData.clientEmail.trim() || undefined,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          services: formData.serviceIds,
          customPrice: formData.customPrice ? Math.round(parseFloat(formData.customPrice) * 100) : undefined,
          notes: formData.notes.trim() || undefined,
          isRecurring: formData.isRecurring,
          recurrencePattern: recurrencePattern ? JSON.stringify(recurrencePattern) : undefined,
          recurrenceEndDate: formData.isRecurring && formData.recurrenceEndDate ? new Date(formData.recurrenceEndDate).toISOString() : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Помилка створення запису')
      }

      onSuccess()
    } catch (error) {
      console.error('Error creating appointment:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Помилка створення запису' })
    } finally {
      setIsLoading(false)
    }
  }

  const activeMasters = masters.filter((m) => m.isActive !== false)

  return (
    <div ref={formRef}>
      <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-lg font-black text-foreground">Новий запис</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Master Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Майстер *</label>
            <select
              value={formData.masterId}
              onChange={(e) => setFormData({ ...formData, masterId: e.target.value })}
              className={cn(
                'w-full h-10 rounded-candy-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-foreground',
                errors.masterId && 'border-red-500'
              )}
            >
              <option value="">Оберіть майстра</option>
              {activeMasters.map((master) => (
                <option key={master.id} value={master.id}>
                  {master.name}
                </option>
              ))}
            </select>
            {errors.masterId && <p className="text-red-500 text-xs mt-1">{errors.masterId}</p>}
          </div>

          {/* Services Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Послуги *</label>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-candy-xs p-2">
              {services.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Немає доступних послуг</p>
              ) : (
                services.map((service) => (
                  <label
                    key={service.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-candy-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                      formData.serviceIds.includes(service.id) && 'bg-candy-purple/10 dark:bg-candy-purple/20'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={formData.serviceIds.includes(service.id)}
                      onChange={() => handleServiceToggle(service.id)}
                      className="w-4 h-4 rounded border-gray-300 text-candy-purple focus:ring-candy-purple"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-foreground">{service.name}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {service.duration} хв • {new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(service.price)}
                      </span>
                    </div>
                  </label>
                ))
              )}
            </div>
            {errors.services && <p className="text-red-500 text-xs mt-1">{errors.services}</p>}
            {formData.serviceIds.length > 0 && (
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                <p>Тривалість: <span className="font-bold">{calculateDuration()} хв</span></p>
                <p>Вартість: <span className="font-bold">{new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(calculateTotalPrice())}</span></p>
              </div>
            )}
          </div>

          {/* Custom Price */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Індивідуальна ціна (опціонально)
            </label>
            <Input
              type="number"
              value={formData.customPrice}
              onChange={(e) => setFormData({ ...formData, customPrice: e.target.value })}
              placeholder="Вкажіть ціну в гривнях (замінить стандартну)"
              min="0"
              step="0.01"
              className="w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Якщо вказано, ця ціна буде використовуватися замість суми послуг
            </p>
          </div>

          {/* Client Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-foreground dark:text-white">Ім&apos;я клієнта *</label>
              <Input
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                placeholder="Ім'я клієнта"
                className={errors.clientName ? 'border-red-500' : ''}
              />
              {errors.clientName && <p className="text-red-500 text-xs mt-1">{errors.clientName}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-foreground dark:text-white">Телефон *</label>
              <Input
                type="tel"
                value={formData.clientPhone}
                onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                placeholder="+380501234567"
                className={errors.clientPhone ? 'border-red-500' : ''}
              />
              {errors.clientPhone && <p className="text-red-500 text-xs mt-1">{errors.clientPhone}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5 text-foreground dark:text-white">Email (опціонально)</label>
            <Input
              type="email"
              value={formData.clientEmail}
              onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
              placeholder="email@example.com"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-foreground dark:text-white">Дата *</label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                min={format(new Date(), 'yyyy-MM-dd')}
                className={errors.date ? 'border-red-500' : ''}
              />
              {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Час *</label>
              <select
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className={cn(
                  'w-full h-10 rounded-candy-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-foreground',
                  errors.time && 'border-red-500'
                )}
                disabled={isLoadingSlots || !formData.masterId || !formData.date}
              >
                <option value="">Оберіть час</option>
                {Array.from({ length: 24 * 2 }, (_, i) => {
                  const hour = Math.floor(i / 2)
                  const minute = (i % 2) * 30
                  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
                  const slot = `${formData.date}T${timeStr}`
                  const available = availableSlots.includes(slot)
                  return (
                    <option key={timeStr} value={timeStr} disabled={!available}>
                      {timeStr} {available ? '' : '(зайнято)'}
                    </option>
                  )
                })}
              </select>
              {isLoadingSlots && <p className="text-xs text-gray-500 mt-1">Завантаження доступних часів...</p>}
              {errors.time && <p className="text-red-500 text-xs mt-1">{errors.time}</p>}
            </div>
          </div>

          {/* Recurring Appointment */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="isRecurring"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-candy-blue focus:ring-candy-blue"
              />
              <label htmlFor="isRecurring" className="text-sm font-semibold text-foreground dark:text-white cursor-pointer">
                Циклічний запис
              </label>
            </div>

            {formData.isRecurring && (
              <div className="space-y-3 pl-6 border-l-2 border-candy-blue/30">
                {/* Recurrence Type */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground dark:text-white">
                    Тип циклічності
                  </label>
                  <select
                    value={formData.recurrenceType}
                    onChange={(e) => setFormData({ ...formData, recurrenceType: e.target.value as 'daily' | 'weekly' | 'monthly', daysOfWeek: [] })}
                    className="w-full h-10 rounded-candy-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-foreground"
                  >
                    <option value="daily">Щодня</option>
                    <option value="weekly">Щотижня</option>
                    <option value="monthly">Щомісяця</option>
                  </select>
                </div>

                {/* Days of Week (for weekly) */}
                {formData.recurrenceType === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground dark:text-white">
                      Дні тижня
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 1, label: 'Пн' },
                        { value: 2, label: 'Вт' },
                        { value: 3, label: 'Ср' },
                        { value: 4, label: 'Чт' },
                        { value: 5, label: 'Пт' },
                        { value: 6, label: 'Сб' },
                        { value: 0, label: 'Нд' },
                      ].map((day) => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            const newDays = formData.daysOfWeek.includes(day.value)
                              ? formData.daysOfWeek.filter((d) => d !== day.value)
                              : [...formData.daysOfWeek, day.value]
                            setFormData({ ...formData, daysOfWeek: newDays })
                          }}
                          className={cn(
                            'px-3 py-1.5 rounded-candy-xs text-sm font-bold transition-all',
                            formData.daysOfWeek.includes(day.value)
                              ? 'candy-blue text-white shadow-soft-lg'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          )}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                    {formData.daysOfWeek.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">Оберіть хоча б один день</p>
                    )}
                  </div>
                )}

                {/* End Date */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground dark:text-white">
                    Дата закінчення циклу *
                  </label>
                  <Input
                    type="date"
                    value={formData.recurrenceEndDate}
                    onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                    min={formData.date}
                    className="w-full"
                  />
                  {!formData.recurrenceEndDate && (
                    <p className="text-xs text-red-500 mt-1">Вкажіть дату закінчення</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-2">Примітки</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Додаткові примітки..."
              rows={3}
              className="w-full rounded-candy-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-foreground resize-none"
            />
          </div>

          {errors.submit && (
            <div className="bg-red-500/10 border border-red-500 rounded-candy-xs p-3">
              <p className="text-red-500 text-sm">{errors.submit}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Створення...' : 'Створити запис'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Скасувати
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
    </div>
  )
}



