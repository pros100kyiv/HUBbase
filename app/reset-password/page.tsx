'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

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
      <AuthLayout title="Відновлення паролю">
        <div className="text-center text-gray-400">Перевірка токену...</div>
      </AuthLayout>
    )
  }

  if (!tokenValid) {
    return (
      <AuthLayout title="Відновлення паролю">
        {errors.submit && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{errors.submit}</p>
          </div>
        )}
        <Button onClick={() => router.push('/login')} className="w-full" size="lg">
          Повернутися до входу
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Відновлення паролю">
      {email && (
        <p className="text-sm text-gray-400 text-center mb-4">
          Встановіть новий пароль для: <span className="text-candy-blue">{email}</span>
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">Новий пароль *</label>
          <Input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Мінімум 6 символів"
            required
            className={cn(errors.password && 'border-red-500 focus-visible:ring-red-500 focus-visible:border-red-500')}
          />
          {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">Підтвердіть пароль *</label>
          <Input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            placeholder="Введіть пароль ще раз"
            required
            className={cn(errors.confirmPassword && 'border-red-500 focus-visible:ring-red-500 focus-visible:border-red-500')}
          />
          {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
        </div>

        {errors.submit && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
            <p className="text-red-400 text-sm">{errors.submit}</p>
          </div>
        )}

        <Button type="submit" disabled={isLoading} className="w-full" size="lg">
          {isLoading ? 'Зміна паролю...' : 'Змінити пароль'}
        </Button>

        <div className="text-center text-sm text-gray-400 pt-2">
          <button type="button" onClick={() => router.push('/login')} className="text-gray-300 hover:text-white font-medium transition-colors">
            Повернутися до входу
          </button>
        </div>
      </form>
    </AuthLayout>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <AuthLayout title="Відновлення паролю">
        <div className="text-center text-gray-400">Завантаження...</div>
      </AuthLayout>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}

