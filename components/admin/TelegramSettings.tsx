'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { TelegramOAuth } from './TelegramOAuth'

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
  const [clientPasswordCount, setClientPasswordCount] = useState(1)
  const [settingPhoto, setSettingPhoto] = useState(false)

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
    <div className="space-y-4">
      {/* Telegram OAuth */}
      <TelegramOAuth
        businessId={business.id}
        onConnected={(data) => {
          onUpdate({
            ...business,
            telegramChatId: data.user?.telegramId?.toString()
          })
        }}
      />

      {/* Інформація про токен та логотип бота */}
      {telegramBotToken && (
        <div className="card-candy p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 space-y-3">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            ✅ Токен бота встановлено автоматично при реєстрації
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            Токен: {telegramBotToken.substring(0, 10)}...
          </p>
          <div className="pt-2 border-t border-green-200 dark:border-green-800">
            <p className="text-xs text-green-700 dark:text-green-300 mb-2">Логотип бота (як у проекті Xbase)</p>
            <Button
              size="sm"
              disabled={settingPhoto}
              onClick={async () => {
                setSettingPhoto(true)
                try {
                  const res = await fetch('/api/telegram/set-bot-photo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ businessId: business.id }),
                  })
                  const data = await res.json()
                  const { toast } = await import('@/components/ui/toast')
                  if (data.success) {
                    toast({ title: 'Готово', description: 'Фото бота оновлено на логотип проекту.', type: 'success' })
                  } else {
                    toast({ title: 'Не вдалося встановити фото', description: data.error || 'Спробуйте пізніше або завантажте public/icon.png в @BotFather → Edit Bot → Edit Botpic.', type: 'error', duration: 6000 })
                  }
                } catch (e) {
                  const { toast } = await import('@/components/ui/toast')
                  toast({ title: 'Помилка', description: 'Помилка запиту', type: 'error' })
                } finally {
                  setSettingPhoto(false)
                }
              }}
            >
              {settingPhoto ? 'Встановлення…' : 'Встановити логотип бота'}
            </Button>
          </div>
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
