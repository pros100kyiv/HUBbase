'use client'

import { useState, useEffect } from 'react'
import { XIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ErrorToast } from '@/components/ui/error-toast'
import { cn } from '@/lib/utils'

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

export function ProfileSetupModal({ business, onComplete, onClose }: ProfileSetupModalProps) {
  const [formData, setFormData] = useState({
    name: business?.name || '',
    phone: business?.phone || '',
    niche: business?.niche || 'OTHER',
    customNiche: business?.customNiche || '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [showCustomNiche, setShowCustomNiche] = useState(false)
  const [showErrorToast, setShowErrorToast] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    // Генеруємо ідентифікатор автоматично, якщо його немає
    if (!business?.businessIdentifier) {
      const identifier = Math.floor(10000 + Math.random() * 90000).toString()
      setFormData(prev => ({ ...prev, identifier }))
    }
  }, [business])

  useEffect(() => {
    // Показуємо поле для кастомної категорії, якщо вибрано "Інше"
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

    // Валідація телефону (український формат)
    const phoneRegex = /^(\+380|380|0)[0-9]{9}$/
    const cleanPhone = formData.phone.replace(/\s/g, '').replace(/[()-]/g, '')
    if (!phoneRegex.test(cleanPhone)) {
      setErrors({ phone: 'Невірний формат телефону. Використовуйте формат: +380XXXXXXXXX' })
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

      // Нормалізуємо телефон
      let normalizedPhone = cleanPhone
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = `+380${normalizedPhone.slice(1)}`
      } else if (normalizedPhone.startsWith('380')) {
        normalizedPhone = `+${normalizedPhone}`
      } else if (!normalizedPhone.startsWith('+380')) {
        normalizedPhone = `+380${normalizedPhone}`
      }

      // Перевіряємо довжину нормалізованого телефону
      if (normalizedPhone.length !== 13) {
        setErrors({ phone: 'Невірний формат телефону. Має бути 13 символів: +380XXXXXXXXX' })
        setIsSaving(false)
        return
      }

      const response = await fetch(`/api/business/${business.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          phone: normalizedPhone,
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-candy-lg shadow-soft-xl p-6 md:p-8 my-auto max-h-[calc(100vh-2rem)] overflow-y-auto">
        {/* Close button - завжди доступний */}
        <button
          onClick={() => {
            // Якщо профіль заповнений - викликаємо onComplete
            if (business?.profileCompleted) {
              onComplete(business)
            } else {
              // Якщо профіль не заповнений - викликаємо onClose (якщо є)
              // або просто закриваємо модальне вікно
              if (onClose) {
                onClose()
              } else {
                // Якщо onClose не передано, викликаємо onComplete з поточним бізнесом
                onComplete(business)
              }
            }
          }}
          className="absolute top-4 right-4 p-2 rounded-candy-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={business?.profileCompleted ? 'Закрити' : 'Закрити (профіль не заповнений)'}
        >
          <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-black text-candy-blue dark:text-blue-400 mb-2">
            Заповнення профілю
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Заповніть основну інформацію про ваш бізнес
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="+380XXXXXXXXX"
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
              Формат: +380XXXXXXXXX
            </p>
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

