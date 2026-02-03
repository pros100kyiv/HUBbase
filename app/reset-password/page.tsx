'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setErrors({ submit: 'Токен відновлення не надано' })
      setIsValidating(false)
      return
    }

    // Перевіряємо валідність токену
    fetch(`/api/auth/reset-password?token=${token}`)
      .then(async (res) => {
        const data = await res.json()
        if (data.valid) {
          setTokenValid(true)
          setEmail(data.email)
        } else {
          setErrors({ submit: data.error || 'Невірний або застарілий токен відновлення' })
        }
      })
      .catch(() => {
        setErrors({ submit: 'Помилка при перевірці токену' })
      })
      .finally(() => {
        setIsValidating(false)
      })
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    // Валідація
    if (formData.password.length < 6) {
      setErrors({ password: 'Пароль має бути мінімум 6 символів' })
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: 'Паролі не співпадають' })
      return
    }

    setIsLoading(true)

    try {
      const token = searchParams.get('token')
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrors({ submit: data.error || 'Помилка при зміні паролю' })
        return
      }

      // Успішно змінено пароль
      alert('Пароль успішно змінено! Тепер ви можете увійти з новим паролем.')
      router.push('/login')
    } catch (error) {
      setErrors({ submit: 'Помилка при зміні паролю' })
    } finally {
      setIsLoading(false)
    }
  }

  if (isValidating) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-12 px-4">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1920')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
        </div>
        <div className="relative z-10 w-full max-w-md bg-gray-800 dark:bg-gray-900 border border-gray-700 rounded-candy-lg backdrop-blur-sm shadow-soft-xl p-8">
          <h2 className="text-3xl md:text-4xl font-black mb-6 text-candy-blue dark:text-blue-400 text-center uppercase">
            ВІДНОВЛЕННЯ ПАРОЛЮ
          </h2>
          <div className="text-center text-gray-400">Перевірка токену...</div>
        </div>
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-12 px-4">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1920')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
        </div>
        <div className="relative z-10 w-full max-w-md bg-gray-800 dark:bg-gray-900 border border-gray-700 rounded-candy-lg backdrop-blur-sm shadow-soft-xl p-8">
          <h2 className="text-3xl md:text-4xl font-black mb-6 text-candy-blue dark:text-blue-400 text-center uppercase">
            ВІДНОВЛЕННЯ ПАРОЛЮ
          </h2>
          {errors.submit && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 mb-4">
              <p className="text-red-400 text-sm">{errors.submit}</p>
            </div>
          )}
          <button
            onClick={() => router.push('/login')}
            className="w-full py-3 rounded-candy-sm bg-gradient-to-r from-candy-blue to-candy-purple text-white font-bold text-lg shadow-soft-lg hover:from-candy-blue/90 hover:to-candy-purple/90 transition-all"
          >
            Повернутися до входу
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-12 px-4">
      {/* Blurred Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1920')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
      </div>

      {/* Dark Gray Form */}
      <div className="relative z-10 w-full max-w-md bg-gray-800 dark:bg-gray-900 border border-gray-700 rounded-candy-lg backdrop-blur-sm shadow-soft-xl p-8">
        <h2 className="text-3xl md:text-4xl font-black mb-6 text-candy-blue dark:text-blue-400 text-center uppercase">
          ВІДНОВЛЕННЯ ПАРОЛЮ
        </h2>

        {email && (
          <p className="text-sm text-gray-400 text-center mb-4">
            Встановіть новий пароль для: <span className="text-candy-blue">{email}</span>
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Новий пароль *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Мінімум 6 символів"
              required
              className={`w-full px-4 py-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 border ${
                errors.password ? 'border-red-500' : 'border-gray-600'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
            {errors.password && (
              <p className="text-red-400 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Підтвердіть пароль *</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="Введіть пароль ще раз"
              required
              className={`w-full px-4 py-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 border ${
                errors.confirmPassword ? 'border-red-500' : 'border-gray-600'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
            {errors.confirmPassword && (
              <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          {errors.submit && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3">
              <p className="text-red-400 text-sm">{errors.submit}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-candy-sm bg-gradient-to-r from-candy-blue to-candy-purple text-white font-bold text-lg shadow-soft-lg hover:from-candy-blue/90 hover:to-candy-purple/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Зміна паролю...' : 'Змінити пароль'}
          </button>

          <div className="text-center text-sm text-gray-400 pt-2">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="text-candy-blue hover:text-candy-purple hover:underline font-medium"
            >
              Повернутися до входу
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-12 px-4">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1920')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
        </div>
        <div className="relative z-10 w-full max-w-md bg-gray-800 dark:bg-gray-900 border border-gray-700 rounded-candy-lg backdrop-blur-sm shadow-soft-xl p-8">
          <h2 className="text-3xl md:text-4xl font-black mb-6 text-candy-blue dark:text-blue-400 text-center uppercase">
            ВІДНОВЛЕННЯ ПАРОЛЮ
          </h2>
          <div className="text-center text-gray-400">Завантаження...</div>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}

