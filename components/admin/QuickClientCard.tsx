'use client'

import { useState } from 'react'
import { XIcon, UserIcon, PhoneIcon, CheckIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'
import { ErrorToast } from '@/components/ui/error-toast'

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
  const [formData, setFormData] = useState({
    name: editingClient?.name || initialName,
    phone: editingClient?.phone || initialPhone,
    email: editingClient?.email || '',
    notes: editingClient?.notes || '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showErrorToast, setShowErrorToast] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const normalizePhone = (phone: string) => {
    let cleaned = phone.replace(/\s/g, '').replace(/[()-]/g, '')
    if (cleaned.startsWith('0')) {
      cleaned = `+380${cleaned.slice(1)}`
    } else if (cleaned.startsWith('380')) {
      cleaned = `+${cleaned}`
    } else if (!cleaned.startsWith('+380')) {
      cleaned = `+380${cleaned}`
    }
    return cleaned
  }

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

    // Нормалізація телефону
    const normalizedPhone = normalizePhone(formData.phone)
    if (normalizedPhone.length !== 13) {
      setErrorMessage('Невірний формат телефону. Використовуйте формат: +380XXXXXXXXX')
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
            name: formData.name.trim(),
            phone: normalizedPhone,
            email: formData.email.trim() || null,
            notes: formData.notes.trim() || null,
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
                name: formData.name.trim(),
                email: formData.email.trim() || null,
                notes: formData.notes.trim() || null,
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
              notes: formData.notes.trim() || null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-candy-lg shadow-soft-xl p-6">
        {/* Close button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-2 rounded-candy-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        )}

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-black text-candy-blue dark:text-blue-400 mb-2">
            {editingClient ? 'Редагувати клієнта' : 'Швидке створення клієнта'}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {editingClient ? 'Оновіть інформацію про клієнта' : 'Заповніть основну інформацію про клієнта'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ім'я */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
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
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-candy-blue"
              />
            </div>
          </div>

          {/* Телефон */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Номер телефону *
            </label>
            <div className="relative">
              <PhoneIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+380XXXXXXXXX"
                required
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-candy-blue"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Формат: +380XXXXXXXXX
            </p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Email (опціонально)
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="client@example.com"
              className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-candy-blue"
            />
          </div>

          {/* Примітки */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Примітки (опціонально)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Додаткові примітки про клієнта..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-candy-blue resize-none"
            />
          </div>

          {/* Кнопки */}
          <div className="flex gap-3 pt-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white font-bold rounded-candy-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Скасувати
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-candy-blue to-candy-purple text-white font-bold rounded-candy-sm shadow-soft-lg hover:shadow-soft-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
  )
}

