'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { TelegramAuthButton } from '@/components/auth/TelegramAuthButton'
import { Input } from '@/components/ui/input'
import { ErrorToast } from '@/components/ui/error-toast'
import { cn } from '@/lib/utils'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    slug: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [showErrorToast, setShowErrorToast] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showLoginLinkInToast, setShowLoginLinkInToast] = useState(false)
  
  // Перевіряємо параметри URL на наявність помилок
  useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
      const decoded = decodeURIComponent(error)
      const friendlyMessages: Record<string, string> = {
        not_registered: 'Цей email не зареєстровано. Зареєструйте бізнес нижче.',
      }
      const message = friendlyMessages[decoded] || decoded || 'Помилка при реєстрації. Спробуйте ще раз.'
      setErrorMessage(message)
      setShowErrorToast(true)
      setErrors({ submit: message })
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setIsLoading(true)

    // Клієнтська валідація email (додаткова перевірка)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setErrorMessage('Невірний формат email')
      setShowErrorToast(true)
      setErrors({ email: 'Невірний формат email', submit: 'Невірний формат email' })
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.toLowerCase().trim(),
          password: formData.password,
          phone: formData.slug ? undefined : undefined, // slug не відправляємо, він генерується автоматично
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrorMessage(data.error || 'Помилка при реєстрації')
        setShowLoginLinkInToast(response.status === 409)
        setShowErrorToast(true)
        setErrors({ submit: data.error || 'Помилка при реєстрації' })
        setIsLoading(false)
        return
      }

      // Перевіряємо чи є всі необхідні поля
      if (!data.business || !data.business.id || !data.business.name) {
        setErrors({ submit: 'Невірні дані бізнесу' })
        setIsLoading(false)
        return
      }

      // Зберігаємо бізнес в localStorage (в продакшені використовуйте cookies)
      localStorage.setItem('business', JSON.stringify(data.business))
      // Після реєстрації нового бізнесу — у кабінеті показати модалку заповнення профілю
      if (!data.isLogin) {
        localStorage.setItem('showProfileModal', '1')
      }
      
      // Показуємо повідомлення про успіх
      if (data.isLogin) {
        setErrorMessage('Успішний вхід в існуючий акаунт')
      } else {
        setErrorMessage('Бізнес успішно зареєстровано та синхронізовано з базою даних')
      }
      setShowErrorToast(true)
      
      // Перенаправляємо на dashboard через невелику затримку для показу повідомлення
      setTimeout(() => {
        router.replace('/dashboard')
      }, 1500)
    } catch (error) {
      setErrorMessage('Помилка при реєстрації. Будь ласка, спробуйте ще раз.')
      setShowErrorToast(true)
      setErrors({ submit: 'Помилка при реєстрації' })
    } finally {
      setIsLoading(false)
    }
  }

  const baseInputClass = 'w-full min-h-[48px] px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-colors'
  const errorInputClass = 'border-red-500/70 focus:ring-red-500/50'

  return (
    <AuthLayout title="Реєстрація">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">Назва бізнесу *</label>
          <Input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Наприклад: 045 Barbershop"
            required
            className={cn(baseInputClass, errors.name && errorInputClass)}
          />
          {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">Email *</label>
          <Input
            type="email"
            inputMode="email"
            value={formData.email}
            onChange={(e) => {
              const value = e.target.value
              setFormData({ ...formData, email: value })
              if (errors.email) setErrors({ ...errors, email: '' })
            }}
            placeholder="your@email.com"
            required
            className={cn(baseInputClass, errors.email && errorInputClass)}
          />
          {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">Пароль *</label>
          <Input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Мінімум 6 символів"
            required
            className={cn(baseInputClass, errors.password && errorInputClass)}
          />
          {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">URL slug (опціонально)</label>
          <Input
            type="text"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            placeholder="045-barbershop"
            className={cn(baseInputClass, errors.slug && errorInputClass)}
          />
          <p className="text-xs text-gray-400 mt-1">Якщо не вказано, буде згенеровано автоматично</p>
          {errors.slug && <p className="text-red-400 text-xs mt-1">{errors.slug}</p>}
        </div>

        {errors.submit && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3">
            <p className="text-red-400 text-sm">{errors.submit}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg shadow-black/20"
        >
          {isLoading ? 'Реєстрація...' : 'Зареєструватися'}
        </button>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
          <div className="relative flex justify-center text-sm"><span className="px-3 bg-transparent text-gray-400">або</span></div>
        </div>

        <button
          type="button"
          disabled={isLoading}
          onClick={() => { window.location.href = '/api/auth/google' }}
          className="w-full min-h-[52px] px-6 py-3.5 rounded-xl gap-3 flex items-center justify-center bg-white text-black border border-white/20 hover:bg-gray-100 transition-all active:scale-[0.98] font-medium"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Зареєструватися через Google
        </button>

        <TelegramAuthButton text="Зареєструватися через Telegram" isRegister={true} />

        <div className="text-center text-sm text-gray-400 pt-2">
          Вже маєте акаунт?{' '}
          <button type="button" onClick={() => router.push('/login')} className="text-gray-300 hover:text-white font-medium transition-colors">
            Увійти
          </button>
        </div>
      </form>

      {showErrorToast && (
        <ErrorToast
          message={errorMessage}
          onClose={() => setShowErrorToast(false)}
          showLoginLink={showLoginLinkInToast}
          onLogin={() => { setShowErrorToast(false); router.push('/login') }}
        />
      )}
    </AuthLayout>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <AuthLayout title="Реєстрація">
        <div className="text-center text-gray-400">Завантаження...</div>
      </AuthLayout>
    }>
      <RegisterForm />
    </Suspense>
  )
}

