'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format, isValid } from 'date-fns'
import { toast } from '@/components/ui/toast'
import { XIcon } from '@/components/icons'
import { ErrorToast } from '@/components/ui/error-toast'
import { ModalPortal } from '@/components/ui/modal-portal'
import { Button } from '@/components/ui/button'

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
    customServiceName?: string | null
    customPrice?: number | null
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
    customService: appointment.customServiceName || '',
    customPrice: appointment.customPrice != null && appointment.customPrice > 0 ? Math.round(appointment.customPrice / 100) : 0,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showErrorToast, setShowErrorToast] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
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

      if (formData.customService.trim()) {
        appointmentData.customServiceName = formData.customService.trim()
        appointmentData.customPrice = formData.customPrice > 0 ? formData.customPrice * 100 : null
      } else {
        appointmentData.customServiceName = null
        appointmentData.customPrice = null
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
    <ModalPortal>
      <div ref={formRef} className="modal-overlay sm:!p-4">
        <div className="relative w-[95%] sm:w-full sm:max-w-2xl sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0">
        <button
          type="button"
          onClick={onCancel}
          className="modal-close text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30 rounded-xl"
          aria-label="Закрити"
        >
          <XIcon className="w-5 h-5" />
        </button>

        <div className="pr-10 mb-4 flex-shrink-0">
          <h2 className="modal-title">Редагувати запис</h2>
          <p className="modal-subtitle">Оновіть інформацію про запис</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 min-h-0 overflow-y-auto">
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
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setServiceSearchQuery('')
                  setShowServiceModal(true)
                }}
                className="w-full px-4 py-2.5 border border-white/20 rounded-lg bg-white/10 text-white hover:bg-white/15 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                Обрати послуги
                {formData.serviceIds.length > 0 && (
                  <span className="text-xs opacity-80">({formData.serviceIds.length})</span>
                )}
              </button>
              {formData.serviceIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 border border-white/20 rounded-lg bg-white/5 min-h-[44px]">
                  {formData.serviceIds.map((id) => {
                    const s = services.find((x) => x.id === id)
                    return s ? (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-green-500/20 text-green-400 border border-green-500/50"
                      >
                        {s.name}
                        <button
                          type="button"
                          onClick={() => handleServiceToggle(id)}
                          className="ml-0.5 p-0.5 rounded hover:bg-green-500/30"
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
                className="modal-overlay sm:!p-4 z-[200]"
                onClick={() => setShowServiceModal(false)}
              >
                <div
                  className="relative w-[95%] sm:w-full max-w-md modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setShowServiceModal(false)}
                    className="modal-close text-gray-400 hover:text-white rounded-xl"
                    aria-label="Закрити"
                  >
                    <XIcon className="w-5 h-5" />
                  </button>
                  <div className="pr-10 mb-2 flex-shrink-0">
                    <h3 className="modal-title">Обрати послуги</h3>
                    <input
                      type="text"
                      value={serviceSearchQuery}
                      onChange={(e) => setServiceSearchQuery(e.target.value)}
                      placeholder="Пошук за назвою..."
                      className="mt-2 w-full px-3 py-2 min-h-[44px] border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30"
                      autoFocus
                    />
                  </div>
                  <div className="flex-1 p-2 min-h-0 overflow-y-auto">
                    {services
                      .filter((s) =>
                        s.name.toLowerCase().includes(serviceSearchQuery.trim().toLowerCase())
                      )
                      .map((service) => (
                        <label
                          key={service.id}
                          className="flex items-center gap-3 p-3 rounded-lg border border-transparent hover:bg-white/5 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={formData.serviceIds.includes(service.id)}
                            onChange={() => handleServiceToggle(service.id)}
                            className="rounded border-white/30 text-green-500 focus:ring-green-500/50"
                          />
                          <span className="flex-1 text-sm text-white">
                            {service.name}
                          </span>
                          <span className="text-xs text-gray-400">
                            {Math.round(service.price)} грн · {service.duration} хв
                          </span>
                        </label>
                      ))}
                    {services.filter((s) =>
                      s.name.toLowerCase().includes(serviceSearchQuery.trim().toLowerCase())
                    ).length === 0 && (
                      <p className="p-4 text-center text-sm text-gray-400">
                        {serviceSearchQuery.trim() ? 'Нічого не знайдено' : 'Немає послуг'}
                      </p>
                    )}
                  </div>
                  <div className="p-4 border-t border-white/10">
                    <Button
                      type="button"
                      onClick={() => setShowServiceModal(false)}
                      className="w-full bg-green-500 hover:bg-green-600 text-white"
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
    </ModalPortal>
  )
}

