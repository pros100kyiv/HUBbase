'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface TelegramSettingsProps {
  business: {
    id: string
    telegramBotToken?: string | null
    telegramChatId?: string | null
    telegramNotificationsEnabled?: boolean
  }
  onUpdate: (updated: any) => void
}

export function TelegramSettings({ business, onUpdate }: TelegramSettingsProps) {
  const [telegramBotToken] = useState(business.telegramBotToken || '')
  const [telegramUsers, setTelegramUsers] = useState<any[]>([])
  const [activePasswords, setActivePasswords] = useState<any[]>([])
  const [adminPassword, setAdminPassword] = useState<string | null>(null)
  const [clientPassword, setClientPassword] = useState<string | null>(null)

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

  const generatePassword = async (role: 'ADMIN' | 'CLIENT') => {
    try {
      const response = await fetch('/api/telegram/generate-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          role,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (role === 'ADMIN') {
          setAdminPassword(data.password)
        } else {
          setClientPassword(data.password)
        }
        // Оновлюємо список активних паролів
        loadData()
        const { toast } = await import('@/components/ui/toast')
        toast({ title: 'Пароль згенеровано!', type: 'success', duration: 3000 })
      } else {
        const { toast } = await import('@/components/ui/toast')
        toast({ title: 'Помилка', description: 'Не вдалося згенерувати пароль', type: 'error' })
      }
    } catch (error) {
      console.error('Error generating password:', error)
      const { toast } = await import('@/components/ui/toast')
      toast({ title: 'Помилка', description: 'Помилка при генерації пароля', type: 'error' })
    }
  }

  return (
    <div className="space-y-4">
      {/* Інформація про токен */}
      {telegramBotToken && (
        <div className="card-candy p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            ✅ Токен бота встановлено автоматично при реєстрації
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            Токен: {telegramBotToken.substring(0, 10)}...
          </p>
        </div>
      )}

      {/* Паролі активації */}
      <div className="card-candy p-4">
        <h2 className="text-subheading mb-4">Паролі активації</h2>
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
                onClick={() => generatePassword('ADMIN')}
              >
                Згенерувати
              </Button>
            </div>
            {adminPassword && (
              <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded">
                <code className="block text-lg font-black text-center">{adminPassword}</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 text-center">
                  Відправте користувачу: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">/start {adminPassword}</code>
                </p>
              </div>
            )}
          </div>

          {/* Пароль для клієнтів */}
          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-candy-sm">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-black text-foreground">📢 Пароль для клієнтів (розсилки)</h3>
              <Button
                size="sm"
                onClick={() => generatePassword('CLIENT')}
              >
                Згенерувати
              </Button>
            </div>
            {clientPassword && (
              <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded">
                <code className="block text-lg font-black text-center">{clientPassword}</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 text-center">
                  Відправте клієнтам: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">/start {clientPassword}</code>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Список активних паролів */}
        {activePasswords.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-black text-foreground mb-3">📋 Активні паролі активації</h3>
            <div className="space-y-2">
              {activePasswords.map((user) => (
                <div key={user.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-candy-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {user.role === 'ADMIN' ? '🔐 Адміністратор' : user.role === 'CLIENT' ? '📢 Клієнт' : user.role}
                      </p>
                      {user.firstName && (
                        <p className="text-xs text-gray-500">
                          {user.firstName} {user.lastName || ''}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Створено: {new Date(user.createdAt).toLocaleDateString('uk-UA')}
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
      </div>

      {/* Користувачі */}
      <div className="card-candy p-4">
        <h2 className="text-subheading mb-4">Користувачі Telegram бота</h2>
        
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

      {/* Інструкції */}
      <div className="card-candy p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <h3 className="text-sm font-black text-foreground mb-2">📋 Інструкції</h3>
        <ol className="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
          <li>Токен бота встановлено автоматично при реєстрації</li>
          <li>Згенеруйте паролі для адміністратора та клієнтів</li>
          <li>Налаштуйте webhook: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">npm run telegram:webhook {business.id}</code></li>
          <li>Користувачі відправляють <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">/start &lt;пароль&gt;</code> боту</li>
        </ol>
      </div>
    </div>
  )
}
