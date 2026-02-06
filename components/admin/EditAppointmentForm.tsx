'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format, isValid } from 'date-fns'
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
  const startTimeDate = new Date(appointment.startTime)
  const safeStartTimeDate = isValid(startTimeDate) ? startTimeDate : new Date()
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
    date: format(safeStartTimeDate, 'yyyy-MM-dd'),
    startTime: format(safeStartTimeDate, 'HH:mm'),
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
      // Якщо послуги не вибрані — дефолтна тривалість 30 хвилин
      const effectiveDuration = totalDuration > 0 ? totalDuration : 30
      const endDateTime = new Date(startDateTime.getTime() + effectiveDuration * 60000)

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
    <div ref={formRef} className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full sm:max-w-2xl bg-[#1A1A1A] border border-white/10 rounded-t-xl sm:rounded-xl p-4 sm:p-6 sm:my-auto max-h-[90vh] sm:max-h-[calc(100vh-2rem)] overflow-y-auto text-white shadow-xl">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <XIcon className="w-5 h-5 text-gray-400" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-lg md:text-2xl font-bold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>
            Редагувати запис
          </h2>
          <p className="text-sm text-gray-400">
            Оновіть інформацію про запис
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Master Selection */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Спеціаліст *
            </label>
            <select
              value={formData.masterId}
              onChange={(e) => setFormData({ ...formData, masterId: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
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
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Ім'я клієнта *
            </label>
            <Input
              value={formData.clientName}
              onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              placeholder="Введіть ім'я клієнта"
              required
              className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
            />
          </div>

          {/* Client Phone */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Телефон клієнта *
            </label>
            <Input
              type="tel"
              value={formData.clientPhone}
              onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
              placeholder="+380XXXXXXXXX"
              required
              className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
            />
          </div>

          {/* Services */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Послуги (опціонально)
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-white/20 rounded-lg p-2 bg-white/5">
              {services.map((service) => (
                <label
                  key={service.id}
                  className="flex items-center gap-2 p-2 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={formData.serviceIds.includes(service.id)}
                    onChange={() => handleServiceToggle(service.id)}
                    className="rounded"
                  />
                  <span className="flex-1 text-sm text-white">
                    {service.name} - {service.price} грн ({service.duration} хв)
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Service */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Додаткова послуга (опціонально)
            </label>
            <div className="flex gap-2">
              <Input
                value={formData.customService}
                onChange={(e) => setFormData({ ...formData, customService: e.target.value })}
                placeholder="Назва послуги"
                className="flex-1 border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
              />
              <Input
                type="number"
                value={formData.customPrice}
                onChange={(e) => setFormData({ ...formData, customPrice: Number(e.target.value) })}
                placeholder="Ціна"
                min="0"
                className="w-24 border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Дата *
            </label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Час початку *
            </label>
            <Input
              type="time"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              required
              className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Примітки
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Додаткові примітки..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="px-4 py-3 border border-red-400/50 bg-red-500/10 text-red-400 font-medium rounded-lg hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Видалити
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 border border-white/20 bg-white/10 text-white font-medium rounded-lg hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.masterId || !formData.clientName || !formData.clientPhone}
              className="flex-1 px-4 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
            >
              {isSubmitting ? 'Збереження...' : 'Зберегти зміни'}
            </button>
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

