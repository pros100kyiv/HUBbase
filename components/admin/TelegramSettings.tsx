'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
  const [telegramBotToken, setTelegramBotToken] = useState(business.telegramBotToken || '')
  const [telegramChatId, setTelegramChatId] = useState(business.telegramChatId || '')
  const [telegramNotificationsEnabled, setTelegramNotificationsEnabled] = useState(business.telegramNotificationsEnabled || false)
  const [telegramUsers, setTelegramUsers] = useState<any[]>([])
  const [telegramBroadcasts, setTelegramBroadcasts] = useState<any[]>([])
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [passwordForm, setPasswordForm] = useState({ role: 'CLIENT', firstName: '', lastName: '' })
  const [showBroadcastForm, setShowBroadcastForm] = useState(false)
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', targetRole: '' })

  useEffect(() => {
    if (business.id) {
      Promise.all([
        fetch(`/api/telegram/users?businessId=${business.id}`)
          .then(res => res.json())
          .then(data => setTelegramUsers(Array.isArray(data) ? data : []))
          .catch(() => setTelegramUsers([])),
        fetch(`/api/telegram/broadcasts?businessId=${business.id}`)
          .then(res => res.json())
          .then(data => setTelegramBroadcasts(Array.isArray(data) ? data : []))
          .catch(() => setTelegramBroadcasts([]))
      ])
    }
  }, [business.id])

  const handleSave = async () => {
    try {
      const response = await fetch('/api/telegram/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          botToken: telegramBotToken,
          chatId: telegramChatId || null,
          notificationsEnabled: telegramNotificationsEnabled,
        }),
      })

      if (response.ok) {
        const { toast } = await import('@/components/ui/toast')
        toast({ title: 'Успішно!', description: 'Telegram бота налаштовано', type: 'success', duration: 2000 })
        onUpdate({
          ...business,
          telegramBotToken,
          telegramChatId,
          telegramNotificationsEnabled,
        })
      } else {
        const { toast } = await import('@/components/ui/toast')
        toast({ title: 'Помилка', description: 'Не вдалося налаштувати бота', type: 'error', duration: 3000 })
      }
    } catch (error) {
      console.error('Error setting up Telegram bot:', error)
      const { toast } = await import('@/components/ui/toast')
      toast({ title: 'Помилка', description: 'Помилка при збереженні', type: 'error', duration: 3000 })
    }
  }

  const handleGeneratePassword = async () => {
    try {
      const response = await fetch('/api/telegram/generate-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          role: passwordForm.role,
          firstName: passwordForm.firstName || null,
          lastName: passwordForm.lastName || null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setGeneratedPassword(data.password)
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

  const handleCreateBroadcast = async () => {
    try {
      const response = await fetch('/api/telegram/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          title: broadcastForm.title,
          message: broadcastForm.message,
          targetRole: broadcastForm.targetRole || null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setTelegramBroadcasts([data.broadcast, ...telegramBroadcasts])
        setBroadcastForm({ title: '', message: '', targetRole: '' })
        setShowBroadcastForm(false)
        const { toast } = await import('@/components/ui/toast')
        toast({ title: 'Розсилку створено!', type: 'success', duration: 2000 })
      } else {
        const { toast } = await import('@/components/ui/toast')
        toast({ title: 'Помилка', description: 'Не вдалося створити розсилку', type: 'error' })
      }
    } catch (error) {
      console.error('Error creating broadcast:', error)
      const { toast } = await import('@/components/ui/toast')
      toast({ title: 'Помилка', description: 'Помилка при створенні розсилки', type: 'error' })
    }
  }

  const handleSendBroadcast = async (broadcastId: string) => {
    try {
      const response = await fetch(`/api/telegram/broadcasts/${broadcastId}/send`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        const { toast } = await import('@/components/ui/toast')
        toast({
          title: 'Розсилку відправлено!',
          description: `Відправлено: ${data.sentCount}, Помилок: ${data.failedCount}`,
          type: 'success',
          duration: 3000
        })
        // Оновлюємо список
        const updated = await fetch(`/api/telegram/broadcasts?businessId=${business.id}`)
          .then(res => res.json())
        setTelegramBroadcasts(updated)
      } else {
        const { toast } = await import('@/components/ui/toast')
        toast({ title: 'Помилка', description: 'Не вдалося відправити розсилку', type: 'error' })
      }
    } catch (error) {
      console.error('Error sending broadcast:', error)
      const { toast } = await import('@/components/ui/toast')
      toast({ title: 'Помилка', description: 'Помилка при відправці', type: 'error' })
    }
  }

  const getRoleName = (role: string) => {
    const roles: Record<string, string> = {
      DEVELOPER: 'Розробник',
      OWNER: 'Власник',
      ADMIN: 'Адміністратор',
      MANAGER: 'Менеджер',
      EMPLOYEE: 'Співробітник',
      CLIENT: 'Клієнт',
      VIEWER: 'Переглядач',
    }
    return roles[role] || role
  }

  return (
    <div className="space-y-4">
      {/* Налаштування бота */}
      <div className="card-candy p-4">
        <h2 className="text-subheading mb-4">Налаштування Telegram бота</h2>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2">Токен бота</label>
            <Input
              type="password"
              placeholder="Введіть токен Telegram бота"
              value={telegramBotToken}
              onChange={(e) => setTelegramBotToken(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Отримайте токен від @BotFather в Telegram
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">ID чату (опціонально)</label>
            <Input
              placeholder="ID чату для сповіщень"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="telegramNotifications"
              checked={telegramNotificationsEnabled}
              onChange={(e) => setTelegramNotificationsEnabled(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="telegramNotifications" className="text-sm font-medium">
              Увімкнути сповіщення
            </label>
          </div>

          <Button onClick={handleSave} className="w-full">
            Зберегти налаштування
          </Button>
        </div>
      </div>

      {/* Генерація паролів */}
      <div className="card-candy p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-subheading">Паролі активації</h2>
          <Button size="sm" onClick={() => setShowPasswordForm(!showPasswordForm)}>
            {showPasswordForm ? 'Скасувати' : '+ Генерувати пароль'}
          </Button>
        </div>

        {showPasswordForm && (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-candy-sm mb-3">
            <div>
              <label className="block text-sm font-medium mb-2">Роль</label>
              <select
                value={passwordForm.role}
                onChange={(e) => setPasswordForm({ ...passwordForm, role: e.target.value })}
                className="w-full p-2 rounded-candy-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              >
                <option value="CLIENT">Клієнт</option>
                <option value="ADMIN">Адміністратор</option>
                <option value="MANAGER">Менеджер</option>
                <option value="EMPLOYEE">Співробітник</option>
                <option value="VIEWER">Переглядач</option>
                <option value="DEVELOPER">Розробник</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Ім'я (опціонально)</label>
              <Input
                placeholder="Ім'я користувача"
                value={passwordForm.firstName}
                onChange={(e) => setPasswordForm({ ...passwordForm, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Прізвище (опціонально)</label>
              <Input
                placeholder="Прізвище користувача"
                value={passwordForm.lastName}
                onChange={(e) => setPasswordForm({ ...passwordForm, lastName: e.target.value })}
              />
            </div>
            <Button onClick={handleGeneratePassword} className="w-full">
              Згенерувати пароль
            </Button>
          </div>
        )}

        {generatedPassword && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-candy-sm">
            <p className="text-sm font-medium mb-2">✅ Пароль активації згенеровано:</p>
            <code className="block p-2 bg-white dark:bg-gray-800 rounded text-lg font-black text-center mb-2">
              {generatedPassword}
            </code>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Відправте користувачу команду: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">/start {generatedPassword}</code>
            </p>
          </div>
        )}
      </div>

      {/* Розсилки */}
      <div className="card-candy p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-subheading">Розсилки</h2>
          <Button size="sm" onClick={() => setShowBroadcastForm(!showBroadcastForm)}>
            {showBroadcastForm ? 'Скасувати' : '+ Створити розсилку'}
          </Button>
        </div>

        {showBroadcastForm && (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-candy-sm mb-3">
            <div>
              <label className="block text-sm font-medium mb-2">Назва розсилки</label>
              <Input
                placeholder="Назва"
                value={broadcastForm.title}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Текст повідомлення</label>
              <textarea
                placeholder="Текст розсилки"
                value={broadcastForm.message}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                className="w-full p-2 rounded-candy-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 min-h-[100px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Цільова аудиторія (залишити порожнім для всіх)</label>
              <select
                value={broadcastForm.targetRole}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, targetRole: e.target.value })}
                className="w-full p-2 rounded-candy-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              >
                <option value="">Всі користувачі</option>
                <option value="CLIENT">Клієнти</option>
                <option value="ADMIN">Адміністратори</option>
                <option value="MANAGER">Менеджери</option>
                <option value="EMPLOYEE">Співробітники</option>
              </select>
            </div>
            <Button
              onClick={handleCreateBroadcast}
              className="w-full"
              disabled={!broadcastForm.title || !broadcastForm.message}
            >
              Створити розсилку
            </Button>
          </div>
        )}

        {telegramBroadcasts.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            Немає створених розсилок
          </p>
        ) : (
          <div className="space-y-2">
            {telegramBroadcasts.map((broadcast) => (
              <div key={broadcast.id} className="p-3 rounded-candy-sm bg-gray-100 dark:bg-gray-800">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-black text-foreground">{broadcast.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{broadcast.message.substring(0, 50)}...</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Статус: {broadcast.status === 'draft' ? 'Чернетка' : broadcast.status === 'scheduled' ? 'Заплановано' : broadcast.status === 'sent' ? 'Відправлено' : 'Скасовано'}
                      {broadcast.targetRole && ` | Аудиторія: ${broadcast.targetRole}`}
                    </p>
                    {broadcast.status === 'sent' && (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Відправлено: {broadcast.sentCount} | Помилок: {broadcast.failedCount}
                      </p>
                    )}
                  </div>
                </div>
                {broadcast.status === 'draft' && (
                  <Button
                    size="sm"
                    onClick={() => handleSendBroadcast(broadcast.id)}
                    className="w-full mt-2"
                  >
                    Відправити розсилку
                  </Button>
                )}
              </div>
            ))}
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
                      Роль: {getRoleName(user.role)}
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
          <li>Отримайте токен від @BotFather в Telegram</li>
          <li>Введіть токен та збережіть налаштування</li>
          <li>Налаштуйте webhook: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">npm run telegram:webhook {business.id}</code></li>
          <li>Згенеруйте пароль активації для користувачів</li>
          <li>Користувачі відправляють <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">/start &lt;пароль&gt;</code> боту</li>
        </ol>
      </div>
    </div>
  )
}

