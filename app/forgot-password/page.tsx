'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrors({ submit: data.error || 'Помилка при відправці запиту' })
        return
      }

      setIsSuccess(true)
    } catch (error) {
      setErrors({ submit: 'Помилка при відправці запиту' })
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <AuthLayout title="Перевірте email">
        <div className="space-y-4">
          <p className="text-gray-300 text-center">
            Якщо email <span className="text-candy-blue font-medium">{email}</span> існує в системі, на нього було відправлено інструкції для відновлення паролю.
          </p>
          <p className="text-sm text-gray-400 text-center">
            Перевірте папку «Спам», якщо лист не надійшов.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-3">
              <p className="text-blue-400 text-xs">
                <strong>Розробка:</strong> Перевірте консоль сервера для отримання токену відновлення.
              </p>
            </div>
          )}
          <Button onClick={() => router.push('/login')} className="w-full" size="lg">
            Повернутися до входу
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Відновлення паролю">
      <p className="text-sm text-gray-400 text-center mb-6">
        Введіть email вашого бізнес-акаунту, і ми надішлемо вам інструкції для відновлення паролю.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">Email *</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className={cn(errors.email && 'border-red-500 focus-visible:ring-red-500 focus-visible:border-red-500')}
          />
          {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
        </div>

        {errors.submit && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
            <p className="text-red-400 text-sm">{errors.submit}</p>
          </div>
        )}

        <Button type="submit" disabled={isLoading} className="w-full" size="lg">
          {isLoading ? 'Відправка...' : 'Відправити інструкції'}
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

