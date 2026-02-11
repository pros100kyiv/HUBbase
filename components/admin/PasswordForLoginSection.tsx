'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

interface PasswordForLoginSectionProps {
  businessId: string
  email?: string
}

export function PasswordForLoginSection({ businessId, email }: PasswordForLoginSectionProps) {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchStatus() {
      try {
        const res = await fetch(`/api/auth/password-status?businessId=${businessId}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setHasPassword(!!data.hasPassword)
        }
      } catch {
        if (!cancelled) setHasPassword(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchStatus()
    return () => { cancelled = true }
  }, [businessId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 6) {
      setError('Пароль має бути мінімум 6 символів')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Паролі не збігаються')
      return
    }
    if (hasPassword && !currentPassword.trim()) {
      setError('Введіть поточний пароль')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          newPassword,
          confirmPassword,
          ...(hasPassword && currentPassword ? { currentPassword: currentPassword.trim() } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast({
          title: 'Готово',
          description: data.message || 'Пароль збережено.',
          type: 'success',
        })
        setHasPassword(true)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setError(data.error || 'Не вдалося зберегти пароль')
      }
    } catch {
      setError('Помилка з\'єднання')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl p-4 md:p-6 card-glass animate-pulse">
        <div className="h-6 w-48 bg-white/10 rounded mb-4" />
        <div className="h-4 w-full bg-white/10 rounded mb-2" />
        <div className="h-10 bg-white/10 rounded" />
      </div>
    )
  }

  return (
    <div className="rounded-xl p-4 md:p-6 card-glass">
      <h2 className="text-lg font-bold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>
        Пароль для входу по пошті
      </h2>
      <p className="text-sm text-gray-400 mb-6">
        {hasPassword
          ? 'Ви можете змінити пароль і далі входити через email та пароль або через Telegram.'
          : 'Ви зареєструвалися через Telegram. Створіть пароль, щоб також мати можливість входити через email та пароль.'}
        {email && (
          <span className="block mt-1 text-gray-500">
            Вхід по email: <strong className="text-gray-300">{email}</strong>
          </span>
        )}
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {hasPassword && (
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Поточний пароль</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
              autoComplete="current-password"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">
            {hasPassword ? 'Новий пароль' : 'Новий пароль'}
          </label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Мінімум 6 символів"
            className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
            autoComplete="new-password"
            minLength={6}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">Підтвердіть пароль</label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Повторіть пароль"
            className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
            autoComplete="new-password"
          />
        </div>
        {error && (
          <p className="text-sm text-red-400" role="alert">{error}</p>
        )}
        <Button
          type="submit"
          disabled={saving}
          className={cn(
            'w-full px-6 py-3 font-semibold rounded-lg transition-all active:scale-[0.98]',
            hasPassword
              ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
              : 'bg-white text-black hover:bg-gray-100'
          )}
          style={!hasPassword ? { boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' } : {}}
        >
          {saving ? 'Збереження...' : hasPassword ? 'Змінити пароль' : 'Створити пароль'}
        </Button>
      </form>
    </div>
  )
}
