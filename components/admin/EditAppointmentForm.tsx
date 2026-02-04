'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { toast } from '@/components/ui/toast'
import { XIcon } from '@/components/icons'
import { ErrorToast } from '@/components/ui/error-toast'

interface EditAppointmentFormProps {
  appointment: {
    id: string
    masterId: string
    clientName: string
    clientPhone: string
    startTime: string
    endTime: string
    status: string
    services?: string
    notes?: string
  }
  businessId: string
  masters: Array<{ id: string; name: string }>
  services: Array<{ id: string; name: string; price: number; duration: number }>
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
  const [formData, setFormData] = useState({
    masterId: appointment.masterId,
    clientName: appointment.clientName,
    clientPhone: appointment.clientPhone,
    serviceIds: (() => {
      try {
        if (appointment.services) {
          const parsed = JSON.parse(appointment.services)
          return Array.isArray(parsed) ? parsed : []
        }
      } catch (e) {
        // Ignore
      }
      return []
    })(),
    date: format(new Date(appointment.startTime), 'yyyy-MM-dd'),
    startTime: format(new Date(appointment.startTime), 'HH:mm'),
    notes: appointment.notes || '',
    customService: '',
    customPrice: 0,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showErrorToast, setShowErrorToast] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

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
    setShowErrorToast(false)

    try {
      const startDateTime = new Date(`${formData.date}T${formData.startTime}`)
      const selectedServices = services.filter((s) => formData.serviceIds.includes(s.id))
      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0)
      const endDateTime = new Date(startDateTime.getTime() + totalDuration * 60000)

      const appointmentData: any = {
        masterId: formData.masterId,
        clientName: formData.clientName.trim(),
        clientPhone: formData.clientPhone.trim(),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        services: JSON.stringify(formData.serviceIds),
        notes: formData.notes?.trim() || null,
      }

      if (formData.customService && formData.customPrice > 0) {
        appointmentData.customService = formData.customService
        appointmentData.customPrice = formData.customPrice
      }

      // Отримуємо businessId з appointment або передаємо через props
      const response = await fetch(`/api/appointments/${appointment.id}?businessId=${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...appointmentData,
          businessId, // Додаємо businessId для перевірки прав доступу
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update appointment')
      }

      toast({ title: 'Запис оновлено', type: 'success' })
      onSuccess()
    } catch (error) {
      console.error('Error updating appointment:', error)
      const errorMsg = error instanceof Error ? error.message : 'Не вдалося оновити запис'
      setErrorMessage(errorMsg)
      setShowErrorToast(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Ви впевнені, що хочете видалити цей запис? Цю дію неможливо скасувати.')) {
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/appointments/${appointment.id}?businessId=${encodeURIComponent(businessId)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete appointment')
      }

      toast({ title: 'Запис видалено', type: 'success' })
      onSuccess()
    } catch (error) {
      console.error('Error deleting appointment:', error)
      const errorMsg = error instanceof Error ? error.message : 'Не вдалося видалити запис'
      setErrorMessage(errorMsg)
      setShowErrorToast(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div ref={formRef} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-candy-lg shadow-soft-xl p-6 my-8">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 rounded-candy-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-black text-candy-blue dark:text-blue-400 mb-2">
            Редагувати запис
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Оновіть інформацію про запис
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Master Selection */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Спеціаліст *
            </label>
            <select
              value={formData.masterId}
              onChange={(e) => setFormData({ ...formData, masterId: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-candy-blue"
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
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
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
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
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
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Послуги *
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2">
              {services.map((service) => (
                <label
                  key={service.id}
                  className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-candy-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={formData.serviceIds.includes(service.id)}
                    onChange={() => handleServiceToggle(service.id)}
                    className="rounded"
                  />
                  <span className="flex-1 text-sm text-gray-900 dark:text-white">
                    {service.name} - {service.price} грн ({service.duration} хв)
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Service */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
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
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Дата *
            </label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Час початку *
            </label>
            <Input
              type="time"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Примітки
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Додаткові примітки..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-candy-blue resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="px-4 py-3 bg-red-500 text-white font-bold rounded-candy-sm hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Видалити
            </Button>
            <Button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white font-bold rounded-candy-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Скасувати
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.masterId || !formData.clientName || !formData.clientPhone || formData.serviceIds.length === 0}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-candy-blue to-candy-purple text-white font-bold rounded-candy-sm shadow-soft-lg hover:shadow-soft-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Збереження...' : 'Зберегти зміни'}
            </Button>
          </div>
        </form>

        {/* Error Toast */}
        {showErrorToast && errorMessage && (
          <ErrorToast
            message={errorMessage}
            onClose={() => {
              setShowErrorToast(false)
              setErrorMessage('')
            }}
          />
        )}
      </div>
    </div>
  )
}

