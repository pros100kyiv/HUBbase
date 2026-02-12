'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BuildingIcon } from '@/components/icons'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Зберігаємо токен розробника
        localStorage.setItem('adminToken', data.token)
        localStorage.setItem('adminEmail', email)
        router.push('/admin/control-center')
      } else {
        setError(data.error || 'Невірний email або пароль')
      }
    } catch (error) {
      setError('Помилка при вході')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl p-6 md:p-8 card-glass-elevated">
        <div className="text-center mb-8">
          <BuildingIcon className="w-14 h-14 mx-auto text-blue-400 mb-4" />
          <h1 className="text-xl md:text-2xl font-bold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>
            Центр управління
          </h1>
          <p className="text-sm text-gray-400">
            Вхід для розробника
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-400/50 rounded-lg p-4 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email розробника
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
              placeholder="developer@xbase.online"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.25)' }}
          >
            {isLoading ? 'Вхід...' : 'Увійти'}
          </button>
        </form>
      </div>
    </div>
  )
}

