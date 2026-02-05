'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { toast } from '@/components/ui/toast'

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
  const [formData, setFormData] = useState({
    masterId: masters[0]?.id || '',
    clientName: '',
    clientPhone: '',
    serviceIds: [] as string[],
    date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    customService: '',
    customPrice: 0,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      const endDateTime = new Date(startDateTime.getTime() + totalDuration * 60000)

      const appointmentData: any = {
        businessId,
        masterId: formData.masterId,
        clientName: formData.clientName,
        clientPhone: formData.clientPhone,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        status: 'Pending',
        services: JSON.stringify(formData.serviceIds),
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
                Послуги *
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {services.map((service) => (
                  <label
                    key={service.id}
                    className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-candy-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={formData.serviceIds.includes(service.id)}
                      onChange={() => handleServiceToggle(service.id)}
                      className="rounded"
                    />
                    <span className="flex-1 text-sm">
                      {service.name} - {service.price} грн ({service.duration} хв)
                    </span>
                  </label>
                ))}
              </div>
            </div>

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
                disabled={isSubmitting || !formData.masterId || !formData.clientName || !formData.clientPhone || formData.serviceIds.length === 0}
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
