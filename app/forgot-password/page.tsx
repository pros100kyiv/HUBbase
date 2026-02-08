'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setDevResetUrl(null)
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

      if (typeof data.resetUrl === 'string') setDevResetUrl(data.resetUrl)
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
          {process.env.NODE_ENV === 'development' && devResetUrl && (
            <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-3 space-y-2">
              <p className="text-blue-400 text-xs">
                <strong>Розробка:</strong> Посилання для скидання пароля (без email):
              </p>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  readOnly
                  value={devResetUrl}
                  className="flex-1 min-w-0 text-xs bg-black/20 border border-white/20 rounded px-2 py-1.5 text-gray-300 font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(devResetUrl)
                    toast({ title: 'Скопійовано', type: 'success' })
                  }}
                  className="text-xs px-2 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white whitespace-nowrap"
                >
                  Копіювати
                </button>
              </div>
            </div>
          )}
          {process.env.NODE_ENV === 'development' && !devResetUrl && (
            <div className="bg-amber-500/20 border border-amber-500 rounded-lg p-3">
              <p className="text-amber-400 text-xs">
                <strong>Розробка:</strong> Якщо email не знайдено, посилання не генерується. Перевірте консоль сервера для токену.
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
          <button type="button" onClick={() => router.push('/login')} className="text-gray-300 hover:text-white font-medium transition-colors active:opacity-70">
            Повернутися до входу
          </button>
        </div>
      </form>
    </AuthLayout>
  )
}

