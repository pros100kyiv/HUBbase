'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format, isValid } from 'date-fns'
import { toast } from '@/components/ui/toast'
import { ModalPortal } from '@/components/ui/modal-portal'

interface CreateAppointmentFormProps {
  businessId: string
  masters: Array<{ id: string; name: string }>
  services: Array<{ id: string; name: string; price: number; duration: number }>
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
  const initialDate = selectedDate && isValid(selectedDate) ? selectedDate : new Date()
  const [formData, setFormData] = useState({
    masterId: masters[0]?.id || '',
    clientName: '',
    clientPhone: '',
    serviceIds: [] as string[],
    date: format(initialDate, 'yyyy-MM-dd'),
    startTime: '09:00',
    customService: '',
    customPrice: 0,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [serviceSearchQuery, setServiceSearchQuery] = useState('')

  useEffect(() => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

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
    setIsSubmitting(true)

    try {
      const startDateTime = new Date(`${formData.date}T${formData.startTime}`)
      const selectedServices = services.filter((s) => formData.serviceIds.includes(s.id))
      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0)
      // Якщо послуги не вибрані — дефолтна тривалість 30 хвилин
      const effectiveDuration = totalDuration > 0 ? totalDuration : 30
      const endDateTime = new Date(startDateTime.getTime() + effectiveDuration * 60000)

      const appointmentData: any = {
        businessId,
        masterId: formData.masterId,
        clientName: formData.clientName,
        clientPhone: formData.clientPhone,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        status: 'Pending',
        services: formData.serviceIds.length > 0 ? JSON.stringify(formData.serviceIds) : JSON.stringify([]),
        isFromBooking: false,
      }

      if (formData.customService && formData.customPrice > 0) {
        appointmentData.customService = formData.customService
        appointmentData.customPrice = formData.customPrice
      }

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointmentData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create appointment')
      }

      toast({ title: 'Запис створено', type: 'success' })
      onSuccess()
    } catch (error) {
      console.error('Error creating appointment:', error)
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося створити запис',
        type: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div ref={formRef}>
      <Card className="card-candy">
        <CardHeader>
          <CardTitle className="text-subheading">Створити новий запис</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Master Selection */}
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Спеціаліст *
              </label>
              <select
                value={formData.masterId}
                onChange={(e) => setFormData({ ...formData, masterId: e.target.value })}
                required
                className="w-full px-3 py-2.5 sm:py-2 min-h-[48px] sm:min-h-0 border border-gray-300 dark:border-gray-700 rounded-candy-sm bg-white dark:bg-gray-800 text-foreground"
              >
                <option value="">Оберіть спеціаліста</option>
                {masters.map((master) => (
                  <option key={master.id} value={master.id}>
                    {master.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Client Name */}
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Ім'я клієнта *
              </label>
              <Input
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                placeholder="Введіть ім'я клієнта"
                required
              />
            </div>

            {/* Client Phone */}
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Телефон клієнта *
              </label>
              <Input
                type="tel"
                value={formData.clientPhone}
                onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                placeholder="+380XXXXXXXXX"
                required
              />
            </div>

            {/* Services */}
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Послуги (опціонально)
              </label>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setServiceSearchQuery('')
                    setShowServiceModal(true)
                  }}
                  className="w-full justify-center border-gray-300 dark:border-gray-600 text-foreground"
                >
                  Обрати послуги
                  {formData.serviceIds.length > 0 && (
                    <span className="ml-2 text-xs opacity-80">({formData.serviceIds.length})</span>
                  )}
                </Button>
                {formData.serviceIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 border border-gray-200 dark:border-gray-700 rounded-candy-sm bg-gray-50 dark:bg-gray-800/50 min-h-[44px]">
                    {formData.serviceIds.map((id) => {
                      const s = services.find((x) => x.id === id)
                      return s ? (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-primary/10 text-primary dark:bg-primary/20 border border-primary/30"
                        >
                          {s.name}
                          <button
                            type="button"
                            onClick={() => handleServiceToggle(id)}
                            className="ml-0.5 p-0.5 rounded hover:bg-primary/20"
                            aria-label="Прибрати"
                          >
                            ×
                          </button>
                        </span>
                      ) : null
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal вибору послуг */}
            {showServiceModal && (
              <ModalPortal>
                <div
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                  onClick={() => setShowServiceModal(false)}
                >
                  <div
                    className="w-full max-w-md max-h-[85vh] flex flex-col rounded-xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-4 border-b border-gray-200 dark:border-white/10">
                      <h3 className="text-lg font-semibold text-foreground">Обрати послуги</h3>
                      <input
                        type="text"
                        value={serviceSearchQuery}
                        onChange={(e) => setServiceSearchQuery(e.target.value)}
                        placeholder="Пошук за назвою..."
                        className="mt-3 w-full px-3 py-2 border border-gray-300 dark:border-white/20 rounded-lg bg-white dark:bg-white/10 text-foreground placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                        autoFocus
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 min-h-0">
                      {services
                        .filter((s) =>
                          s.name.toLowerCase().includes(serviceSearchQuery.trim().toLowerCase())
                        )
                        .map((service) => (
                          <label
                            key={service.id}
                            className="flex items-center gap-3 p-3 rounded-lg border border-transparent hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={formData.serviceIds.includes(service.id)}
                              onChange={() => handleServiceToggle(service.id)}
                              className="rounded border-gray-300 dark:border-white/30 text-primary focus:ring-primary"
                            />
                            <span className="flex-1 text-sm text-foreground">
                              {service.name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {service.price} грн · {service.duration} хв
                            </span>
                          </label>
                        ))}
                      {services.filter((s) =>
                        s.name.toLowerCase().includes(serviceSearchQuery.trim().toLowerCase())
                      ).length === 0 && (
                        <p className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                          {serviceSearchQuery.trim() ? 'Нічого не знайдено' : 'Немає послуг'}
                        </p>
                      )}
                    </div>
                    <div className="p-4 border-t border-gray-200 dark:border-white/10">
                      <Button
                        type="button"
                        onClick={() => setShowServiceModal(false)}
                        className="w-full btn-primary"
                      >
                        Готово
                      </Button>
                    </div>
                  </div>
                </div>
              </ModalPortal>
            )}

            {/* Custom Service */}
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Додаткова послуга (опціонально)
              </label>
              <div className="flex gap-2">
                <Input
                  value={formData.customService}
                  onChange={(e) => setFormData({ ...formData, customService: e.target.value })}
                  placeholder="Назва послуги"
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={formData.customPrice}
                  onChange={(e) => setFormData({ ...formData, customPrice: Number(e.target.value) })}
                  placeholder="Ціна"
                  min="0"
                  className="w-24"
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Дата *
              </label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            {/* Start Time */}
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Час початку *
              </label>
              <Input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting || !formData.masterId || !formData.clientName || !formData.clientPhone}
                className="btn-primary flex-1 min-h-[48px] touch-target"
              >
                {isSubmitting ? 'Створення...' : 'Створити запис'}
              </Button>
              <Button
                type="button"
                onClick={onCancel}
                className="btn-secondary min-h-[48px] touch-target"
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
