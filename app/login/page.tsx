'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TelegramAuthButton } from '@/components/auth/TelegramAuthButton'
import { ErrorToast } from '@/components/ui/error-toast'

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
      router.push('/dashboard')
    } catch (error) {
      setErrorMessage('Помилка при вході. Будь ласка, спробуйте ще раз.')
      setShowErrorToast(true)
      setErrors({ submit: 'Помилка при вході' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-12 px-4">
      {/* Blurred Background with Barber/Salon Tools */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1920')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
      </div>

      {/* Dark Gray Form with Rounded Corners */}
      <div className="relative z-10 w-full max-w-md bg-gray-800 dark:bg-gray-900 border border-gray-700 rounded-candy-lg backdrop-blur-sm shadow-soft-xl p-8">
        {/* Blue Title */}
        <h2 className="text-3xl md:text-4xl font-black mb-6 text-candy-blue dark:text-blue-400 text-center uppercase">
          ВХІД ДЛЯ БІЗНЕСУ
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your@email.com"
              required
              className={`w-full px-4 py-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 border ${
                errors.email ? 'border-red-500' : 'border-gray-600'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
            {errors.email && (
              <p className="text-red-400 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">Пароль *</label>
              <button
                type="button"
                onClick={() => router.push('/forgot-password')}
                className="text-xs text-candy-blue hover:text-candy-purple hover:underline"
              >
                Забули пароль?
              </button>
            </div>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Ваш пароль"
              required
              className={`w-full px-4 py-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 border ${
                errors.password ? 'border-red-500' : 'border-gray-600'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
            {errors.password && (
              <p className="text-red-400 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          {errors.submit && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3">
              <p className="text-red-400 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Blue Gradient Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-candy-sm bg-gradient-to-r from-candy-blue to-candy-purple text-white font-bold text-lg shadow-soft-lg hover:from-candy-blue/90 hover:to-candy-purple/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Вхід...' : 'Увійти'}
          </button>

          {/* Divider with "або" */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-gray-800 dark:bg-gray-900 text-gray-400">або</span>
            </div>
          </div>

          {/* Google Login Button - White with Colored Logo */}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              window.location.href = '/api/auth/google'
            }}
            className="w-full py-3 rounded-lg bg-white text-gray-700 font-medium flex items-center justify-center gap-3 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Увійти через Google
          </button>

          {/* Telegram Login Button - White with Telegram Logo */}
          <TelegramAuthButton 
            text="Увійти через Telegram"
            isRegister={false}
          />

          {/* Registration Link */}
          <div className="text-center text-sm text-gray-400 pt-2">
            Немає акаунту?{' '}
            <button
              type="button"
              onClick={() => router.push('/register')}
              className="text-candy-blue hover:text-candy-purple hover:underline font-medium"
            >
              Зареєструватися
            </button>
          </div>
        </form>

        {/* Error Toast */}
        {showErrorToast && (
          <ErrorToast
            message={errorMessage}
            needsRegistration={needsRegistration}
            onRegister={() => router.push('/register')}
            onClose={() => setShowErrorToast(false)}
          />
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-12 px-4">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1920')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
        </div>
        <div className="relative z-10 w-full max-w-md bg-gray-800 dark:bg-gray-900 border border-gray-700 rounded-candy-lg backdrop-blur-sm shadow-soft-xl p-8">
          <h2 className="text-3xl md:text-4xl font-black mb-6 text-candy-blue dark:text-blue-400 text-center uppercase">
            ВХІД ДЛЯ БІЗНЕСУ
          </h2>
          <div className="text-center text-gray-400">Завантаження...</div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

