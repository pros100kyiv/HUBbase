'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

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
        const errorMessage = data.details 
          ? `${data.error}: ${data.details}` 
          : data.error || 'Помилка при вході'
        setErrors({ submit: errorMessage })
        setIsLoading(false)
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
      setErrors({ submit: 'Помилка при вході' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-12 px-4">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1920')] bg-cover bg-center opacity-10" />
      </div>

      <Card className="relative z-10 w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-title text-primary dark:text-purple-400 text-center">
            ВХІД ДЛЯ БІЗНЕСУ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">Email *</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
                required
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">Пароль *</label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Ваш пароль"
                required
                className={errors.password ? 'border-red-500' : ''}
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            {errors.submit && (
              <div className="bg-red-500/10 border border-red-500 rounded-md p-3">
                <p className="text-red-500 text-sm">{errors.submit}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Вхід...' : 'Увійти'}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  або
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2"
              onClick={() => {
                window.location.href = '/api/auth/google'
              }}
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
            </Button>

            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
              Немає акаунту?{' '}
              <button
                onClick={() => router.push('/register')}
                className="text-primary dark:text-purple-400 hover:underline"
              >
                Зареєструватися
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-12 px-4">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Завантаження...</p>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}

