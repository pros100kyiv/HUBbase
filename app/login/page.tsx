'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { TelegramAuthButton } from '@/components/auth/TelegramAuthButton'
import { Input } from '@/components/ui/input'
import { ErrorToast } from '@/components/ui/error-toast'
import { cn } from '@/lib/utils'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [showErrorToast, setShowErrorToast] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [needsRegistration, setNeedsRegistration] = useState(false)

  useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      const errorMessages: Record<string, string> = {
        google_auth_failed: 'Помилка авторизації через Google',
        invalid_token: 'Невірний токен авторизації',
        no_email: 'Email не знайдено в Google акаунті',
        oauth_error: 'Помилка OAuth авторизації',
        oauth_not_configured: 'Google OAuth не налаштовано. Зверніться до адміністратора.',
        account_deactivated: 'Ваш акаунт деактивовано',
        parse_error: 'Помилка обробки даних',
        no_data: 'Дані не отримано',
      }
      setErrors({ submit: errorMessages[error] || 'Помилка авторизації' })
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Login error:', data)
        
        // Якщо потрібне OAuth підтвердження - показуємо повідомлення та кнопку Telegram
        if (data.requiresOAuth && data.deviceId) {
          setErrorMessage(data.error || 'Це новий пристрій. Підтвердіть вхід через Telegram OAuth.')
          setShowErrorToast(true)
          setIsLoading(false)
          // Зберігаємо deviceId для подальшого використання
          localStorage.setItem('pendingDeviceId', data.deviceId)
          setErrors({ submit: data.error || 'Це новий пристрій. Підтвердіть вхід через Telegram OAuth.' })
          return
        }
        
        // Показуємо маленьке вікно з помилкою
        setErrorMessage(data.error || 'Помилка при вході')
        setNeedsRegistration(data.needsRegistration || false)
        setShowErrorToast(true)
        setErrors({ submit: data.error || 'Помилка при вході' })
        setIsLoading(false)
        
        // Якщо користувач не зареєстрований, перенаправляємо на реєстрацію
        if (response.status === 404 && data.needsRegistration) {
          router.push('/register?error=not_registered')
        }
        return
      }

      // Перевіряємо чи є всі необхідні поля
      if (!data.business || !data.business.id || !data.business.name) {
        setErrors({ submit: 'Невірні дані бізнесу' })
        return
      }

      // Зберігаємо бізнес в localStorage
      localStorage.setItem('business', JSON.stringify(data.business))
      
      // Показуємо повідомлення про успіх
      setErrorMessage('Успішний вхід')
      setShowErrorToast(true)
      
      // Перенаправляємо на dashboard через невелику затримку
      setTimeout(() => {
        router.replace('/dashboard')
      }, 1000)
    } catch (error) {
      setErrorMessage('Помилка при вході. Будь ласка, спробуйте ще раз.')
      setShowErrorToast(true)
      setErrors({ submit: 'Помилка при вході' })
    } finally {
      setIsLoading(false)
    }
  }

  const baseInputClass = 'w-full min-h-[48px] px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-colors'
  const errorInputClass = 'border-red-500/70 focus:ring-red-500/50'

  return (
    <AuthLayout title="Вхід">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">Email *</label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="your@email.com"
            required
            className={cn(baseInputClass, errors.email && errorInputClass)}
          />
          {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">Пароль *</label>
            <button
                type="button"
                onClick={() => router.push('/forgot-password')}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Забули пароль?
              </button>
          </div>
          <Input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Ваш пароль"
            required
            className={cn(baseInputClass, errors.password && errorInputClass)}
          />
          {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
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
          {isLoading ? 'Вхід...' : 'Увійти'}
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
          Увійти через Google
        </button>

        <TelegramAuthButton text="Увійти через Telegram" isRegister={false} />

        <div className="text-center text-sm text-gray-400 pt-2">
          Немає акаунту?{' '}
          <button type="button" onClick={() => router.push('/register')} className="text-gray-300 hover:text-white font-medium transition-colors">
            Зареєструватися
          </button>
        </div>
      </form>

      {showErrorToast && (
        <ErrorToast
          message={errorMessage}
          needsRegistration={needsRegistration}
          onRegister={() => router.push('/register')}
          onClose={() => setShowErrorToast(false)}
        />
      )}
    </AuthLayout>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <AuthLayout title="Вхід">
        <div className="text-center text-gray-400">Завантаження...</div>
      </AuthLayout>
    }>
      <LoginForm />
    </Suspense>
  )
}

