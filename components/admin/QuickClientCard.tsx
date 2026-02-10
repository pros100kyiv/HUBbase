'use client'

import { useState, useEffect } from 'react'
import { XIcon, UserIcon, PhoneIcon, CheckIcon } from '@/components/icons'
import { ModalPortal } from '@/components/ui/modal-portal'
import { cn } from '@/lib/utils'
import { normalizeUaPhone, isValidUaPhone } from '@/lib/utils/phone'
import { toast } from '@/components/ui/toast'
import { ErrorToast } from '@/components/ui/error-toast'
import { getSuggestedClientStatus, type ClientStatusValue } from '@/lib/client-status'

export const CLIENT_STATUS_OPTIONS = [
  { value: 'new', label: 'Новий' },
  { value: 'regular', label: 'Постійний' },
  { value: 'vip', label: 'VIP' },
  { value: 'inactive', label: 'Неактивний' },
] as const

const VALID_STATUSES: ClientStatusValue[] = ['new', 'regular', 'vip', 'inactive']
function normalizeStatusForSend(s: string): ClientStatusValue {
  const v = s.trim().toLowerCase()
  return VALID_STATUSES.includes(v as ClientStatusValue) ? (v as ClientStatusValue) : 'new'
}

interface QuickClientCardProps {
  businessId: string
  onSuccess?: (client: any) => void
  onCancel?: () => void
  initialPhone?: string
  initialName?: string
  editingClient?: {
    id: string
    name: string
    phone: string
    email?: string | null
    notes?: string | null
    tags?: string | null
    metadata?: string | null
    status?: string | null
    totalAppointments?: number
    totalSpent?: number
    lastAppointmentDate?: string | null
  } | null
}

export function QuickClientCard({
  businessId,
  onSuccess,
  onCancel,
  initialPhone = '',
  initialName = '',
  editingClient = null,
}: QuickClientCardProps) {
  const suggestedStatus = editingClient
    ? getSuggestedClientStatus(
        editingClient.totalAppointments ?? 0,
        Number(editingClient.totalSpent ?? 0),
        editingClient.lastAppointmentDate ?? null
      )
    : 'new'
  const initialStatus =
    (editingClient?.status && VALID_STATUSES.includes(editingClient.status.trim().toLowerCase() as ClientStatusValue))
      ? (editingClient.status.trim().toLowerCase() as ClientStatusValue)
      : (editingClient ? suggestedStatus : 'new')

  const [formData, setFormData] = useState({
    name: editingClient?.name || initialName,
    phone: editingClient?.phone || initialPhone,
    email: editingClient?.email || '',
    status: initialStatus,
    notes: editingClient?.notes || '',
    tags: editingClient?.tags || '',
    metadata: editingClient?.metadata || '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showErrorToast, setShowErrorToast] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // При відкритті редагування підставити рекомендований статус, якщо у клієнта був "new" або порожній
  useEffect(() => {
    if (!editingClient) return
    const current = (editingClient.status || '').trim().toLowerCase()
    const hadNoStatus = !current || current === 'new'
    if (hadNoStatus && suggestedStatus !== 'new') {
      setFormData((prev) => ({ ...prev, status: suggestedStatus }))
    }
  }, [editingClient?.id, suggestedStatus])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setShowErrorToast(false)

    // Валідація
    if (!formData.name.trim()) {
      setErrorMessage('Введіть ім\'я клієнта')
      setShowErrorToast(true)
      setIsSubmitting(false)
      return
    }

    if (!formData.phone.trim()) {
      setErrorMessage('Введіть номер телефону')
      setShowErrorToast(true)
      setIsSubmitting(false)
      return
    }

    const normalizedPhone = normalizeUaPhone(formData.phone)
    if (!isValidUaPhone(formData.phone)) {
      setErrorMessage('Невірний формат. Введіть номер з 0, наприклад 0671234567')
      setShowErrorToast(true)
      setIsSubmitting(false)
      return
    }

    try {
      let client

      // Якщо редагуємо існуючого клієнта
      if (editingClient) {
        const updateResponse = await fetch(`/api/clients/${editingClient.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId,
            name: formData.name.trim(),
            phone: normalizedPhone,
            email: formData.email.trim() || null,
            status: normalizeStatusForSend(formData.status),
            notes: formData.notes.trim() || null,
            tags: formData.tags.trim() || null,
            metadata: formData.metadata.trim() || null,
          }),
        })

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json()
          const errorMessage = errorData.error || errorData.details || 'Не вдалося оновити клієнта'
          console.error('Client update error:', errorData)
          throw new Error(errorMessage)
        }

        client = await updateResponse.json()
      } else {
        // Перевіряємо, чи клієнт вже існує
        const checkResponse = await fetch(`/api/clients?businessId=${businessId}&phone=${encodeURIComponent(normalizedPhone)}`)
        
        if (checkResponse.ok) {
          const existingClients = await checkResponse.json()
          if (existingClients.length > 0) {
            // Оновлюємо існуючого клієнта
            client = existingClients[0]
            const updateResponse = await fetch(`/api/clients/${client.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                businessId,
                name: formData.name.trim(),
                email: formData.email.trim() || null,
                status: normalizeStatusForSend(formData.status),
                notes: formData.notes.trim() || null,
                tags: formData.tags.trim() || null,
                metadata: formData.metadata.trim() || null,
              }),
            })
            
            if (updateResponse.ok) {
              client = await updateResponse.json()
            }
          }
        }

        // Якщо клієнта не знайдено, створюємо нового
        if (!client) {
          const createResponse = await fetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              businessId,
              name: formData.name.trim(),
              phone: normalizedPhone,
              email: formData.email.trim() || null,
              status: normalizeStatusForSend(formData.status),
              notes: formData.notes.trim() || null,
              tags: formData.tags.trim() || null,
              metadata: formData.metadata.trim() || null,
            }),
          })

          if (!createResponse.ok) {
            const errorData = await createResponse.json()
            const errorMessage = errorData.error || errorData.details || 'Не вдалося створити клієнта'
            console.error('Client creation error:', errorData)
            throw new Error(errorMessage)
          }

          client = await createResponse.json()
        }
      }

      toast({
        title: 'Успішно!',
        description: editingClient ? 'Картка клієнта оновлена' : 'Картка клієнта створена',
        type: 'success',
      })

      if (onSuccess) {
        onSuccess(client)
      }
    } catch (error) {
      console.error('Error creating client:', error)
      const errorMsg = error instanceof Error ? error.message : 'Не вдалося створити картку клієнта'
      setErrorMessage(errorMsg)
      setShowErrorToast(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ModalPortal>
      <div className="modal-overlay sm:!p-4" onClick={onCancel ?? undefined} role="presentation">
        <div className="relative w-[95%] sm:w-full sm:max-w-md sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0" onClick={(e) => e.stopPropagation()}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="modal-close text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            aria-label="Закрити"
          >
            <XIcon className="w-5 h-5" />
          </button>
        )}

        <div className="pr-10 mb-2 flex-shrink-0">
          <h2 className="modal-title">
            {editingClient ? 'Редагувати клієнта' : 'Швидке створення клієнта'}
          </h2>
          <p className="modal-subtitle">
            {editingClient ? 'Оновіть інформацію про клієнта' : 'Заповніть основну інформацію про клієнта'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5 flex-1 min-h-0 overflow-y-auto">
          {/* Ім'я */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Ім'я клієнта *
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Наприклад: Іван Петренко"
                required
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
              />
            </div>
          </div>

          {/* Телефон */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Номер телефону *
            </label>
            <div className="relative">
              <PhoneIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="0XX XXX XX XX"
                required
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Введіть номер з 0, наприклад 0671234567
            </p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Email (опціонально)
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="client@example.com"
              className="w-full px-4 py-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
            />
          </div>

          {/* Статус клієнта */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Статус
            </label>
            <div className="flex flex-wrap gap-2">
              {CLIENT_STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, status: opt.value })}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-target min-h-[44px]',
                    formData.status === opt.value
                      ? opt.value === 'vip'
                        ? 'bg-amber-500/30 text-amber-200 border border-amber-400/50'
                        : opt.value === 'regular'
                          ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50'
                          : opt.value === 'inactive'
                            ? 'bg-gray-500/25 text-gray-300 border border-gray-400/50'
                            : 'bg-white/20 text-white border border-white/30'
                      : 'bg-white/5 text-gray-400 border border-white/15 hover:bg-white/10 hover:text-gray-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {editingClient && suggestedStatus !== formData.status && suggestedStatus !== 'new' && (
              <p className="text-xs text-gray-400 mt-1.5">
                За візитами та сумою рекомендовано: <span className="text-white font-medium">{CLIENT_STATUS_OPTIONS.find((o) => o.value === suggestedStatus)?.label ?? suggestedStatus}</span>
              </p>
            )}
          </div>

          {/* Примітки */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Примітки (опціонально)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Додаткові примітки про клієнта..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 resize-none"
            />
          </div>

          {/* Теги */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Теги (опціонально)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="Наприклад: VIP, Instagram, Постійний"
              className="w-full px-4 py-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
            />
            <p className="text-xs text-gray-400 mt-1">
              Вводьте через кому. Буде збережено як список тегів.
            </p>
          </div>

          {/* Додаткова інформація */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Додаткова інформація (опціонально)
            </label>
            <textarea
              value={formData.metadata}
              onChange={(e) => setFormData({ ...formData, metadata: e.target.value })}
              placeholder="Будь-які деталі про клієнта (наприклад: алергії, побажання, джерело, тощо)"
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 resize-none"
            />
          </div>

          {/* Кнопки */}
          <div className="flex gap-3 pt-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-3 border border-white/20 bg-white/10 text-white font-medium rounded-lg hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Скасувати
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {editingClient ? 'Збереження...' : 'Створення...'}
                </>
              ) : (
                <>
                  <CheckIcon className="w-5 h-5" />
                  {editingClient ? 'Зберегти зміни' : 'Створити клієнта'}
                </>
              )}
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

