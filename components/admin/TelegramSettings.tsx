'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface TelegramSettingsProps {
  business: {
    id: string
    telegramBotToken?: string | null
    telegramChatId?: string | null
    telegramNotificationsEnabled?: boolean
  }
  onUpdate: (updated: any) => void
  onRefetchBusiness?: () => Promise<void>
}

export function TelegramSettings({ business, onUpdate, onRefetchBusiness }: TelegramSettingsProps) {
  const [telegramBotToken, setTelegramBotToken] = useState(business.telegramBotToken || '')
  const [tokenInput, setTokenInput] = useState('')
  const [savingToken, setSavingToken] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [telegramUsers, setTelegramUsers] = useState<any[]>([])
  const [activePasswords, setActivePasswords] = useState<any[]>([])
  const [clientPasswordCount, setClientPasswordCount] = useState(1)
  const [webhookSet, setWebhookSet] = useState<boolean | null>(null)
  const [settingWebhook, setSettingWebhook] = useState(false)

  useEffect(() => {
    setTelegramBotToken(business.telegramBotToken || '')
  }, [business.telegramBotToken])

  const loadData = () => {
    if (business.id) {
      Promise.all([
        fetch(`/api/telegram/users?businessId=${business.id}`)
          .then(res => res.json())
          .then(data => setTelegramUsers(Array.isArray(data) ? data : []))
          .catch(() => setTelegramUsers([])),
        fetch(`/api/telegram/passwords?businessId=${business.id}`)
          .then(res => res.json())
          .then(data => setActivePasswords(Array.isArray(data) ? data : []))
          .catch(() => setActivePasswords([]))
      ])
    }
  }

  useEffect(() => {
    loadData()
  }, [business.id])

  const saveToken = async () => {
    if (!business.id || !tokenInput.trim()) return
    setTokenError(null)
    setSavingToken(true)
    try {
      const res = await fetch('/api/telegram/set-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, token: tokenInput.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTelegramBotToken(tokenInput.trim())
        setTokenInput('')
        await onRefetchBusiness?.()
        const { toast } = await import('@/components/ui/toast')
        toast({ title: data.message || 'Бот підключено', type: 'success', duration: 4000 })
      } else {
        setTokenError(data.error || 'Не вдалося підключити')
      }
    } catch (e: any) {
      setTokenError(e?.message || 'Помилка з\'єднання')
    } finally {
      setSavingToken(false)
    }
  }

  // Статус webhook для отримання повідомлень у кабінеті
  useEffect(() => {
    if (!business.id || !business.telegramBotToken) {
      setWebhookSet(null)
      return
    }
    fetch(`/api/telegram/webhook?businessId=${business.id}`)
      .then((res) => res.json())
      .then((data) => {
        // Вважаємо webhook активним лише коли він прив'язаний саме до цього бізнесу
        if (typeof data?.isCurrentBusinessWebhook === 'boolean') {
          setWebhookSet(data.isCurrentBusinessWebhook)
          return
        }
        // backward-compatible fallback для старішої відповіді API
        setWebhookSet(!!data?.webhook?.url || !!data?.telegramWebhookSetAt)
      })
      .catch(() => setWebhookSet(false))
  }, [business.id, business.telegramBotToken])

  const enableMessagesInCabinet = async () => {
    if (!business.id || settingWebhook) return
    const { toast } = await import('@/components/ui/toast')
    const ok = typeof window !== 'undefined' && window.confirm(
      'Підтвердити? Повідомлення з Telegram-бота будуть з\'являтися в кабінеті (Соцмережі → Повідомлення).'
    )
    if (!ok) return
    setSettingWebhook(true)
    try {
      const res = await fetch('/api/telegram/set-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id }),
      })
      const data = await res.json()
      if (data.success) {
        setWebhookSet(true)
        toast({ title: 'Готово!', description: data.message || 'Повідомлення тепер надходять у кабінет.', type: 'success', duration: 5000 })
      } else {
        toast({ title: 'Помилка', description: data.error || 'Спробуйте пізніше.', type: 'error', duration: 5000 })
      }
    } catch (e) {
      toast({ title: 'Помилка', description: 'Не вдалося налаштувати.', type: 'error' })
    } finally {
      setSettingWebhook(false)
    }
  }

  const generatePassword = async (role: 'ADMIN' | 'CLIENT', count: number = 1) => {
    try {
      const promises = []
      for (let i = 0; i < count; i++) {
        promises.push(
          fetch('/api/telegram/generate-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              businessId: business.id,
              role,
            }),
          })
        )
      }

      const responses = await Promise.all(promises)
      const results = await Promise.all(responses.map(r => r.json()))

      const failed = results.filter(r => !r.success)
      if (failed.length > 0) {
        const { toast } = await import('@/components/ui/toast')
        toast({ title: 'Помилка', description: `Не вдалося згенерувати ${failed.length} паролів`, type: 'error' })
      }

      const successCount = results.filter(r => r.success).length
      if (successCount > 0) {
        // Оновлюємо список активних паролів
        loadData()
        const { toast } = await import('@/components/ui/toast')
        toast({ 
          title: 'Паролі згенеровано!', 
          description: `Успішно згенеровано ${successCount} паролів`,
          type: 'success', 
          duration: 3000 
        })
      }
    } catch (error) {
      console.error('Error generating password:', error)
      const { toast } = await import('@/components/ui/toast')
      toast({ title: 'Помилка', description: 'Помилка при генерації пароля', type: 'error' })
    }
  }

  return (
    <div className="card-candy p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">🤖</span>
        <h3 className="text-lg font-black text-gray-900 dark:text-white">Telegram</h3>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Кожен бізнес підключає свій бот — повідомлення надходитимуть тільки до вашого кабінету.
      </p>

      {/* Токен бота — обов'язково спочатку */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block">Токен бота (з @BotFather)</label>
        <div className="flex gap-2">
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => { setTokenInput(e.target.value); setTokenError(null) }}
            placeholder={telegramBotToken ? 'Змінити токен...' : '123456789:ABCdefGHI...'}
            className="flex-1 px-3 py-2 rounded-candy-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
          />
          <Button
            onClick={saveToken}
            disabled={savingToken || !tokenInput.trim()}
            size="sm"
            className="bg-candy-blue hover:bg-candy-blue/90 text-white"
          >
            {savingToken ? '...' : telegramBotToken ? 'Змінити' : 'Підключити'}
          </Button>
        </div>
        {telegramBotToken && (
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-green-600 dark:text-green-400">Бот підключено ({telegramBotToken.substring(0, 15)}...)</p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={async () => {
                if (!window.confirm('Відключити Telegram? Повідомлення більше не надходитимуть.')) return
                try {
                  const res = await fetch('/api/telegram/disconnect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ businessId: business.id }),
                  })
                  const data = await res.json()
                  if (res.ok && data.success) {
                    setTelegramBotToken('')
                    await onRefetchBusiness?.()
                    const { toast } = await import('@/components/ui/toast')
                    toast({ title: 'Telegram відключено', type: 'success' })
                  } else {
                    const { toast } = await import('@/components/ui/toast')
                    toast({ title: 'Помилка', description: data.error, type: 'error' })
                  }
                } catch (e: any) {
                  const { toast } = await import('@/components/ui/toast')
                  toast({ title: 'Помилка', description: e?.message, type: 'error' })
                }
              }}
            >
              Відключити
            </Button>
          </div>
        )}
        {tokenError && <p className="text-xs text-red-500">{tokenError}</p>}
      </div>

      {/* Отримання повідомлень у кабінеті — один клік: Натиснути → Підтвердити → Готово */}
      {telegramBotToken && (
        <div className="card-candy p-4 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800">
          <h3 className="text-sm font-black text-foreground mb-2">📬 Повідомлення в кабінеті</h3>
          {webhookSet === null ? (
            <p className="text-xs text-gray-500">Перевірка...</p>
          ) : webhookSet ? (
            <p className="text-sm text-sky-800 dark:text-sky-200">
              Готово. Повідомлення з Telegram надходять у розділ <strong>Соцмережі → Повідомлення</strong>.
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                Увімкніть отримання повідомлень — один клік, підтвердження, готово.
              </p>
              <Button
                size="sm"
                disabled={settingWebhook}
                onClick={enableMessagesInCabinet}
                className="bg-sky-600 hover:bg-sky-700 text-white"
              >
                {settingWebhook ? 'Налаштування…' : 'Увімкнути отримання повідомлень'}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Паролі активації — згорнутий за замовчуванням */}
      <details className="card-candy p-4">
        <summary className="cursor-pointer list-none">
          <h2 className="text-subheading inline">Паролі активації</h2>
        </summary>
        <div className="mt-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Згенеруйте паролі для адміністратора та клієнтів. Користувачі використовують команду <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">/start &lt;пароль&gt;</code> в Telegram боті.
        </p>

        {/* Пароль для адміністратора */}
        <div className="space-y-3 mb-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-candy-sm">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-black text-foreground">🔐 Пароль для адміністратора</h3>
              <Button
                size="sm"
                onClick={() => generatePassword('ADMIN', 1)}
              >
                Згенерувати
              </Button>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Можна згенерувати кілька паролів для різних адміністраторів або пристроїв
            </p>
          </div>

          {/* Пароль для клієнтів */}
          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-candy-sm">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-black text-foreground">📢 Паролі для клієнтів (розсилки)</h3>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Кількість паролів
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={clientPasswordCount}
                  onChange={(e) => setClientPasswordCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                  className="w-full p-2 rounded-candy-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <Button
                size="sm"
                onClick={() => generatePassword('CLIENT', clientPasswordCount)}
              >
                Згенерувати {clientPasswordCount > 1 ? `${clientPasswordCount} паролів` : 'пароль'}
              </Button>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              Генеруйте стільки паролів, скільки потрібно клієнтів. Кожен клієнт отримує свій унікальний пароль.
            </p>
          </div>
        </div>

        {/* Список активних паролів */}
        {activePasswords.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-black text-foreground mb-3">📋 Всі активні паролі активації</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Тут відображаються всі паролі, які ще не використані. Після активації користувачем пароль автоматично видаляється зі списку.
            </p>
            
            {/* Паролі адміністраторів */}
            {activePasswords.filter(p => p.role === 'ADMIN').length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-black text-foreground mb-2">🔐 Паролі адміністраторів</h4>
                <div className="space-y-2">
                  {activePasswords.filter(p => p.role === 'ADMIN').map((user) => (
                    <div key={user.id} className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-candy-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            🔐 Адміністратор
                          </p>
                          {user.firstName && (
                            <p className="text-xs text-gray-500">
                              {user.firstName} {user.lastName || ''}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Створено: {new Date(user.createdAt).toLocaleDateString('uk-UA')} {new Date(user.createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <code className="block text-lg font-black text-candy-blue dark:text-candy-mint">
                            {user.activationPassword}
                          </code>
                          <p className="text-xs text-gray-500 mt-1">
                            /start {user.activationPassword}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Паролі клієнтів */}
            {activePasswords.filter(p => p.role === 'CLIENT').length > 0 && (
              <div>
                <h4 className="text-xs font-black text-foreground mb-2">📢 Паролі клієнтів ({activePasswords.filter(p => p.role === 'CLIENT').length})</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {activePasswords.filter(p => p.role === 'CLIENT').map((user) => (
                    <div key={user.id} className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-candy-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            📢 Клієнт
                          </p>
                          {user.firstName && (
                            <p className="text-xs text-gray-500">
                              {user.firstName} {user.lastName || ''}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Створено: {new Date(user.createdAt).toLocaleDateString('uk-UA')} {new Date(user.createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <code className="block text-lg font-black text-candy-purple dark:text-candy-mint">
                            {user.activationPassword}
                          </code>
                          <p className="text-xs text-gray-500 mt-1">
                            /start {user.activationPassword}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </details>

      {/* Користувачі — згорнутий */}
      <details className="card-candy p-4">
        <summary className="cursor-pointer list-none">
          <h2 className="text-subheading inline">Користувачі бота</h2>
          {telegramUsers.length > 0 && (
            <span className="text-xs text-gray-500 ml-2">({telegramUsers.length})</span>
          )}
        </summary>
        <div className="mt-4">
        
        {telegramUsers.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            Немає зареєстрованих користувачів
          </p>
        ) : (
          <div className="space-y-2">
            {telegramUsers.map((user) => (
              <div key={user.id} className="p-3 rounded-candy-sm bg-gray-100 dark:bg-gray-800">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-black text-foreground">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-gray-500">@{user.username || 'без username'}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Роль: {user.role === 'OWNER' ? 'Власник' : user.role === 'ADMIN' ? 'Адміністратор' : user.role === 'MANAGER' ? 'Менеджер' : user.role === 'EMPLOYEE' ? 'Співробітник' : user.role === 'CLIENT' ? 'Клієнт' : 'Переглядач'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded ${user.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                      {user.isActive ? 'Активний' : 'Неактивний'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </details>

      {/* Короткі підказки */}
      <p className="text-xs text-gray-500">
        Швидке підключення: <Link href="/dashboard/social" className="text-candy-blue hover:underline">Соцмережі</Link> → Підключити.
        Власний бот: @BotFather → токен → увімкнути повідомлення.
      </p>
    </div>
  )
}
