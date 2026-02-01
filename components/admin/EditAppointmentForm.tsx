'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, addMinutes } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { XIcon, RepeatIcon } from '@/components/icons'

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

interface Appointment {
  id: string
  masterId: string
  clientName: string
  clientPhone: string
  clientEmail?: string | null
  startTime: string
  endTime: string
  services?: string
  customPrice?: number | null
  notes?: string | null
  status: string
  isRecurring?: boolean
  recurrencePattern?: string | null
  recurrenceEndDate?: string | null
}

interface EditAppointmentFormProps {
  appointment: Appointment
  businessId: string
  masters: Master[]
  services: Service[]
  onSuccess: () => void
  onCancel: () => void
}

export function EditAppointmentForm({
  appointment,
  businessId,
  masters,
  services,
  onSuccess,
  onCancel,
}: EditAppointmentFormProps) {
  const formRef = useRef<HTMLDivElement>(null)
  const startTime = new Date(appointment.startTime)
  const endTime = new Date(appointment.endTime)

  // Парсимо послуги
  let initialServiceIds: string[] = []
  let initialCustomService: string = ''
  
  try {
    if (appointment.services) {
      const parsed = JSON.parse(appointment.services)
      if (Array.isArray(parsed)) {
        initialServiceIds = parsed
      } else if (typeof parsed === 'object' && parsed.serviceIds) {
        initialServiceIds = parsed.serviceIds || []
        initialCustomService = parsed.customService || ''
      }
    }
  } catch (e) {
    // Ignore
  }

  // Парсимо циклічність
  let initialRecurrenceType: 'daily' | 'weekly' | 'monthly' = 'weekly'
  let initialDaysOfWeek: number[] = []
  let initialRecurrenceEndDate = ''
  
  if (appointment.isRecurring && appointment.recurrencePattern) {
    try {
      const pattern = JSON.parse(appointment.recurrencePattern)
      initialRecurrenceType = pattern.type || 'weekly'
      initialDaysOfWeek = pattern.days || []
    } catch (e) {
      // Ignore
    }
  }
  
  if (appointment.recurrenceEndDate) {
    initialRecurrenceEndDate = format(new Date(appointment.recurrenceEndDate), 'yyyy-MM-dd')
  }

  const [formData, setFormData] = useState({
    masterId: appointment.masterId,
    serviceIds: initialServiceIds,
    customService: initialCustomService,
    clientName: appointment.clientName,
    clientPhone: appointment.clientPhone,
    clientEmail: appointment.clientEmail || '',
    date: format(startTime, 'yyyy-MM-dd'),
    time: format(startTime, 'HH:mm'),
    customPrice: appointment.customPrice ? (appointment.customPrice / 100).toFixed(2) : '',
    notes: appointment.notes || '',
    isRecurring: appointment.isRecurring || false,
    recurrenceType: initialRecurrenceType,
    daysOfWeek: initialDaysOfWeek,
    recurrenceEndDate: initialRecurrenceEndDate,
  })
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Автоматична прокрутка до форми
  useEffect(() => {
    if (formRef.current) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [])

  const loadAvailableSlots = useCallback(async () => {
    if (!formData.masterId || !formData.date) return

    setIsLoadingSlots(true)
    try {
      const response = await fetch(
        `/api/availability?masterId=${formData.masterId}&businessId=${businessId}&date=${formData.date}`
      )
      if (response.ok) {
        const data = await response.json()
        // Add current appointment time to available slots (for editing)
        const currentSlot = `${formData.date}T${format(startTime, 'HH:mm')}`
        const slots = data.availableSlots || []
        if (!slots.includes(currentSlot)) {
          slots.push(currentSlot)
        }
        setAvailableSlots(slots)
      }
    } catch (error) {
      console.error('Error loading available slots:', error)
    } finally {
      setIsLoadingSlots(false)
    }
  }, [formData.masterId, formData.date, businessId, startTime])

  useEffect(() => {
    if (formData.masterId && formData.date) {
      loadAvailableSlots()
    } else {
      setAvailableSlots([])
    }
  }, [formData.masterId, formData.date, loadAvailableSlots])

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
    // Allow current appointment time (even if not in available slots)
    const currentSlot = `${formData.date}T${format(startTime, 'HH:mm')}`
    if (slot === currentSlot) return true
    // Check if slot is in available slots
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

  const handleDayToggle = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    // Validation
    if (!formData.masterId) {
      setErrors({ masterId: 'Оберіть спеціаліста' })
      return
    }
    if (formData.serviceIds.length === 0 && !formData.customService.trim()) {
      setErrors({ services: 'Оберіть хоча б одну послугу або вкажіть кастомну' })
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
    const newStartTime = new Date(`${formData.date}T${formData.time}`)
    const newEndTime = addMinutes(newStartTime, duration)

    // Check if time is available (except current appointment time)
    const timeChanged = formData.time !== format(startTime, 'HH:mm') || formData.date !== format(startTime, 'yyyy-MM-dd')
    if (timeChanged && !isTimeAvailable(formData.time)) {
      setErrors({ time: 'Цей час недоступний' })
      return
    }

    setIsLoading(true)
    try {
      const servicesPayload = formData.customService.trim()
        ? {
            serviceIds: formData.serviceIds,
            customService: formData.customService.trim(),
          }
        : formData.serviceIds

      const recurrencePattern = formData.isRecurring ? {
        type: formData.recurrenceType,
        days: formData.recurrenceType === 'weekly' ? formData.daysOfWeek : undefined,
      } : undefined

      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterId: formData.masterId,
          clientName: formData.clientName.trim(),
          clientPhone: formData.clientPhone.trim(),
          clientEmail: formData.clientEmail.trim() || null,
          startTime: newStartTime.toISOString(),
          endTime: newEndTime.toISOString(),
          services: servicesPayload,
          customPrice: formData.customPrice ? Math.round(parseFloat(formData.customPrice) * 100) : null,
          notes: formData.notes.trim() || null,
          isRecurring: formData.isRecurring,
          recurrencePattern: recurrencePattern ? JSON.stringify(recurrencePattern) : null,
          recurrenceEndDate: formData.isRecurring && formData.recurrenceEndDate ? new Date(formData.recurrenceEndDate).toISOString() : null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Помилка оновлення візиту')
      }

      onSuccess()
    } catch (error) {
      console.error('Error updating appointment:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Помилка оновлення візиту' })
    } finally {
      setIsLoading(false)
    }
  }

  const activeMasters = masters.filter((m) => m.isActive !== false)
  const dayNames = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота']

  return (
    <div ref={formRef}>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-black text-foreground">Редагувати візит</CardTitle>
            <button
              onClick={onCancel}
              className="p-1 rounded-candy-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <XIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Master Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Спеціаліст *</label>
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
                        formData.serviceIds.includes(service.id) && 'bg-candy-blue/10 dark:bg-candy-blue/20'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={formData.serviceIds.includes(service.id)}
                        onChange={() => handleServiceToggle(service.id)}
                        className="w-4 h-4 rounded border-gray-300 text-candy-blue focus:ring-candy-blue"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-foreground">{service.name}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          {service.duration} хв • {new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(service.price / 100)}
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
                  <p>Вартість: <span className="font-bold">{new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(calculateTotalPrice() / 100)}</span></p>
                </div>
              )}
            </div>

            {/* Custom Service */}
            <div>
              <label className="block text-sm font-medium mb-2">Кастомна послуга (опціонально)</label>
              <Input
                value={formData.customService}
                onChange={(e) => setFormData({ ...formData, customService: e.target.value })}
                placeholder="Опишіть послугу, яку ви бажаєте"
                className="w-full"
              />
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
                    const available = isTimeAvailable(timeStr)
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
            <div className="border border-gray-200 dark:border-gray-700 rounded-candy-xs p-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-candy-blue focus:ring-candy-blue"
                />
                <div className="flex items-center gap-2">
                  <RepeatIcon className="w-4 h-4 text-candy-blue" />
                  <span className="text-sm font-medium text-foreground">Циклічний візит</span>
                </div>
              </label>

              {formData.isRecurring && (
                <div className="space-y-3 pl-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Тип циклу *</label>
                    <select
                      value={formData.recurrenceType}
                      onChange={(e) => setFormData({ ...formData, recurrenceType: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                      className="w-full h-10 rounded-candy-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-foreground"
                    >
                      <option value="daily">Щодня</option>
                      <option value="weekly">Щотижня</option>
                      <option value="monthly">Щомісяця</option>
                    </select>
                  </div>

                  {formData.recurrenceType === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Дні тижня *</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {dayNames.map((dayName, index) => (
                          <label
                            key={index}
                            className={cn(
                              'flex items-center gap-2 p-2 rounded-candy-xs cursor-pointer border transition-colors',
                              formData.daysOfWeek.includes(index)
                                ? 'bg-candy-blue/10 dark:bg-candy-blue/20 border-candy-blue'
                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={formData.daysOfWeek.includes(index)}
                              onChange={() => handleDayToggle(index)}
                              className="w-4 h-4 rounded border-gray-300 text-candy-blue focus:ring-candy-blue"
                            />
                            <span className="text-xs font-medium text-foreground">{dayName}</span>
                          </label>
                        ))}
                      </div>
                      {errors.recurrence && <p className="text-red-500 text-xs mt-1">{errors.recurrence}</p>}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-2">Дата закінчення циклу *</label>
                    <Input
                      type="date"
                      value={formData.recurrenceEndDate}
                      onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                      min={formData.date}
                      className={errors.recurrence ? 'border-red-500' : ''}
                    />
                    {errors.recurrence && <p className="text-red-500 text-xs mt-1">{errors.recurrence}</p>}
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
                {isLoading ? 'Збереження...' : 'Зберегти зміни'}
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
