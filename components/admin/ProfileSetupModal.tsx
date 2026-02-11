'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { XIcon } from '@/components/icons'
import { ModalPortal } from '@/components/ui/modal-portal'
import { Button } from '@/components/ui/button'
import { ErrorToast } from '@/components/ui/error-toast'
import { cn } from '@/lib/utils'
import { normalizeUaPhone, isValidUaPhone } from '@/lib/utils/phone'

interface ProfileSetupModalProps {
  business: any
  onComplete: (updatedBusiness: any) => void
  onClose?: () => void // Додаємо опціональний callback для закриття
}

const BUSINESS_NICHES = [
  { value: 'SALON', label: 'Салон краси' },
  { value: 'BARBERSHOP', label: 'Барбершоп' },
  { value: 'STO', label: 'СТО (Станція технічного обслуговування)' },
  { value: 'CAR_WASH', label: 'Автомийка' },
  { value: 'SPA', label: 'СПА' },
  { value: 'FITNESS', label: 'Фітнес тренер' },
  { value: 'BEAUTY', label: 'Бюті сфера' },
  { value: 'TIRE_SERVICE', label: 'Шиномонтаж' },
  { value: 'EDUCATION', label: 'Освіта' },
  { value: 'MEDICINE', label: 'Медицина' },
  { value: 'RESTAURANT', label: 'Ресторан' },
  { value: 'OTHER', label: 'Інше' },
]

function getInitialFormData(b: any) {
  return {
    name: b?.name || '',
    phone: b?.phone || '',
    address: b?.address || '',
    description: b?.description || '',
    niche: b?.niche || 'OTHER',
    customNiche: b?.customNiche || '',
  }
}

export function ProfileSetupModal({ business, onComplete, onClose }: ProfileSetupModalProps) {
  const [formData, setFormData] = useState(() => getInitialFormData(business))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [showCustomNiche, setShowCustomNiche] = useState(formData.niche === 'OTHER')
  const [showErrorToast, setShowErrorToast] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Підтягуємо дані з бізнесу при зміні пропса (наприклад після завантаження з localStorage)
  useEffect(() => {
    if (business) {
      setFormData(getInitialFormData(business))
      setShowCustomNiche((business?.niche || 'OTHER') === 'OTHER')
    }
  }, [business?.id, business?.name, business?.phone, business?.address, business?.description, business?.niche, business?.customNiche])

  useEffect(() => {
    setShowCustomNiche(formData.niche === 'OTHER')
  }, [formData.niche])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setIsSaving(true)

    // Перевірка наявності business.id
    if (!business?.id) {
      const errorMsg = 'Помилка: ID бізнесу не знайдено. Будь ласка, увійдіть знову.'
      setErrorMessage(errorMsg)
      setShowErrorToast(true)
      setErrors({ submit: errorMsg })
      setIsSaving(false)
      return
    }

    // Валідація
    if (!formData.name.trim()) {
      setErrors({ name: 'Назва бізнесу обов\'язкова' })
      setIsSaving(false)
      return
    }

    if (!formData.phone.trim()) {
      setErrors({ phone: 'Номер телефону обов\'язковий' })
      setIsSaving(false)
      return
    }

    if (!isValidUaPhone(formData.phone)) {
      setErrors({ phone: 'Невірний формат. Введіть номер з 0, наприклад 0671234567' })
      setIsSaving(false)
      return
    }

    // Перевірка кастомної категорії
    if (formData.niche === 'OTHER' && !formData.customNiche.trim()) {
      setErrors({ customNiche: 'Вкажіть вашу категорію бізнесу' })
      setIsSaving(false)
      return
    }

    try {
      // Генеруємо ідентифікатор, якщо його немає
      let identifier = business?.businessIdentifier
      if (!identifier) {
        // Генеруємо унікальний ідентифікатор
        let attempts = 0
        while (!identifier && attempts < 10) {
          const candidate = Math.floor(10000 + Math.random() * 90000).toString()
          try {
            const checkResponse = await fetch(`/api/business/check-identifier?identifier=${candidate}`)
            if (checkResponse.ok) {
              const checkData = await checkResponse.json()
              if (!checkData.exists) {
                identifier = candidate
                break
              }
            }
          } catch (checkError) {
            console.warn('Error checking identifier:', checkError)
            // Якщо перевірка не вдалася, використовуємо кандидата
            identifier = candidate
            break
          }
          attempts++
        }
        
        if (!identifier) {
          // Якщо не вдалося згенерувати унікальний, використовуємо timestamp
          identifier = Date.now().toString().slice(-5)
        }
      }

      const normalizedPhone = normalizeUaPhone(formData.phone)

      const response = await fetch(`/api/business/${business.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          phone: normalizedPhone,
          address: formData.address?.trim() || null,
          description: formData.description?.trim() || null,
          niche: formData.niche,
          customNiche: formData.niche === 'OTHER' ? formData.customNiche.trim() : null,
          businessIdentifier: identifier,
          profileCompleted: true,
        }),
      })

      let data
      try {
        data = await response.json()
      } catch (parseError) {
        console.error('Error parsing response:', parseError)
        const errorMsg = 'Помилка при обробці відповіді сервера. Будь ласка, спробуйте ще раз.'
        setErrorMessage(errorMsg)
        setShowErrorToast(true)
        setErrors({ submit: errorMsg })
        setIsSaving(false)
        return
      }

      if (!response.ok) {
        // Отримуємо детальне повідомлення про помилку з сервера
        const errorMsg = data?.error || `Помилка при збереженні профілю (код ${response.status}). Будь ласка, спробуйте ще раз.`
        console.error('Profile save error:', {
          status: response.status,
          statusText: response.statusText,
          error: data?.error,
          data,
        })
        setErrorMessage(errorMsg)
        setShowErrorToast(true)
        setErrors({ submit: errorMsg })
        setIsSaving(false)
        return
      }

      // Оновлюємо localStorage
      const updatedBusiness = data.business || business
      if (updatedBusiness) {
        // Додаємо всі необхідні поля
        const fullBusiness = {
          ...updatedBusiness,
          profileCompleted: true,
          businessIdentifier: identifier,
          name: formData.name.trim(),
          phone: normalizedPhone,
          address: formData.address?.trim() || null,
          description: formData.description?.trim() || null,
          niche: formData.niche,
          customNiche: formData.niche === 'OTHER' ? formData.customNiche.trim() : null,
        }
        localStorage.setItem('business', JSON.stringify(fullBusiness))
        
        // Показуємо повідомлення
        try {
          const toastModule = await import('@/components/ui/toast')
          toastModule.toast({
            title: 'Успішно!',
            description: 'Профіль заповнено',
            type: 'success',
          })
        } catch (e) {
          console.warn('Toast not available')
        }

        // Викликаємо onComplete з повними даними
        onComplete(fullBusiness)
      } else {
        setErrors({ submit: 'Не вдалося отримати оновлені дані' })
        setIsSaving(false)
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      const errorMsg = 'Помилка при збереженні профілю. Будь ласка, спробуйте ще раз.'
      setErrorMessage(errorMsg)
      setShowErrorToast(true)
      setErrors({ submit: errorMsg })
      setIsSaving(false)
    }
  }

  return (
    <ModalPortal>
      <div className="modal-overlay sm:!p-4" onClick={onClose ?? undefined} role="presentation">
        <div className="relative w-[95%] sm:w-full sm:max-w-md sm:max-h-[90vh] sm:my-auto modal-content modal-dialog modal-dialog-light flex flex-col min-h-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Close button - завжди доступний */}
        <button
          onClick={() => {
            if (business?.profileCompleted) {
              onComplete(business)
            } else {
              if (onClose) {
                onClose()
              } else {
                onComplete(business)
              }
            }
          }}
          className="touch-target absolute top-3 right-3 sm:top-4 sm:right-4 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
          title={business?.profileCompleted ? 'Закрити' : 'Закрити (профіль не заповнений)'}
          aria-label="Закрити"
        >
          <XIcon className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-black text-candy-blue dark:text-blue-400 mb-2">
            Заповнення профілю
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Заповніть основну інформацію про ваш бізнес. Наявні дані підставлені автоматично.
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email (тільки відображення) */}
          {business?.email && (
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Email
              </label>
              <div className="w-full px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">
                {business.email}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Змінити email можна в налаштуваннях
              </p>
            </div>
          )}

          {/* Назва бізнесу */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Назва бізнесу *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Наприклад: 045 Barbershop"
              required
              className={cn(
                'w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white',
                'placeholder-gray-400 border focus:outline-none focus:ring-2 focus:ring-candy-blue',
                errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              )}
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          {/* Номер телефону */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Номер телефону *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="0XX XXX XX XX"
              required
              className={cn(
                'w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white',
                'placeholder-gray-400 border focus:outline-none focus:ring-2 focus:ring-candy-blue',
                errors.phone ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              )}
            />
            {errors.phone && (
              <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Введіть номер з 0, наприклад 0671234567
            </p>
          </div>

          {/* Адреса */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Адреса
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Місто, вулиця, будинок"
              className={cn(
                'w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white',
                'placeholder-gray-400 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-candy-blue'
              )}
            />
          </div>

          {/* Опис бізнесу */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Опис бізнесу
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Коротко про ваш бізнес, послуги..."
              rows={3}
              className={cn(
                'w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white resize-none',
                'placeholder-gray-400 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-candy-blue'
              )}
            />
          </div>

          {/* Категорія бізнесу */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Категорія бізнесу *
            </label>
            <select
              value={formData.niche}
              onChange={(e) => setFormData({ ...formData, niche: e.target.value, customNiche: '' })}
              className={cn(
                'w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white',
                'border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-candy-blue'
              )}
            >
              {BUSINESS_NICHES.map((niche) => (
                <option key={niche.value} value={niche.value}>
                  {niche.label}
                </option>
              ))}
            </select>
          </div>

          {/* Кастомна категорія */}
          {showCustomNiche && (
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Вкажіть вашу категорію *
              </label>
              <input
                type="text"
                value={formData.customNiche}
                onChange={(e) => setFormData({ ...formData, customNiche: e.target.value })}
                placeholder="Наприклад: Автосервіс, Стоматологія..."
                required={showCustomNiche}
                className={cn(
                  'w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white',
                  'placeholder-gray-400 border border-gray-300 dark:border-gray-600',
                  'focus:outline-none focus:ring-2 focus:ring-candy-blue'
                )}
              />
            </div>
          )}

          {/* Ідентифікатор бізнесу */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Ідентифікатор бізнесу
            </label>
            <div className="px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600">
              <p className="text-lg font-black text-candy-blue dark:text-blue-400">
                {business?.businessIdentifier || 'Генерується автоматично...'}
              </p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Унікальний ідентифікатор вашого бізнесу
            </p>
          </div>

          {/* Кнопка збереження */}
          <Button
            type="submit"
            disabled={isSaving}
            className="w-full py-3 rounded-candy-sm bg-gradient-to-r from-candy-blue to-candy-purple text-white font-bold text-lg shadow-soft-lg hover:from-candy-blue/90 hover:to-candy-purple/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Збереження...' : 'Зберегти профіль'}
          </Button>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Пізніше можна змінити профіль у розділі{' '}
            <Link href="/dashboard/settings?tab=info" className="text-candy-blue dark:text-blue-400 hover:underline font-medium">
              Налаштування → Інформація
            </Link>
          </p>
        </form>
        </div>

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

