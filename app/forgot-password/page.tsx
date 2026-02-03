'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-12 px-4">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1920')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
        </div>
        <div className="relative z-10 w-full max-w-md bg-gray-800 dark:bg-gray-900 border border-gray-700 rounded-candy-lg backdrop-blur-sm shadow-soft-xl p-8">
          <h2 className="text-3xl md:text-4xl font-black mb-6 text-candy-blue dark:text-blue-400 text-center uppercase">
            ПЕРЕВІРТЕ EMAIL
          </h2>
          <div className="space-y-4">
            <p className="text-gray-300 text-center">
              Якщо email <span className="text-candy-blue font-medium">{email}</span> існує в системі, на нього було відправлено інструкції для відновлення паролю.
            </p>
            <p className="text-sm text-gray-400 text-center">
              Перевірте папку "Спам", якщо лист не надійшов.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-3">
                <p className="text-blue-400 text-xs">
                  <strong>Розробка:</strong> Перевірте консоль сервера для отримання токену відновлення.
                </p>
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

        <p className="text-sm text-gray-400 text-center mb-6">
          Введіть email вашого бізнес-акаунту, і ми надішлемо вам інструкції для відновлення паролю.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {isLoading ? 'Відправка...' : 'Відправити інструкції'}
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

