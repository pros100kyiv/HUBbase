'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface TelegramBotMessageSettings {
  welcomeMessage?: string
  newUserMessage?: string
  autoReplyMessage?: string
  bookingEnabled?: boolean
  /** 'both' = вибір з прайсу або без | 'pricelist_only' = тільки з прайсу | 'simple_only' = тільки без послуги */
  bookingServiceMode?: 'both' | 'pricelist_only' | 'simple_only'
  /** true = приймати повідомлення тільки після натискання кнопки «Написати повідомлення» */
  messagesOnlyViaButton?: boolean
}

const DEFAULT_WELCOME = '✅ Вітаємо, {{name}}!\n\nВаша роль: {{role}}\n\nВи отримуватимете сповіщення про нові записи та нагадування.\n\nОберіть дію:'
const DEFAULT_NEW_USER = '👋 Цей бот для сповіщень від бізнесу.\n\nДля доступу зверніться до адміністратора.'
const DEFAULT_AUTO_REPLY = '✅ Дякуємо! Ваше повідомлення отримано. Ми відповімо найближчим часом.'

interface TelegramSettingsProps {
  business: {
    id: string
    telegramBotToken?: string | null
    telegramChatId?: string | null
    telegramNotificationsEnabled?: boolean
    telegramSettings?: string | null
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
  const [webhookSet, setWebhookSet] = useState<boolean | null>(null)
  const [settingWebhook, setSettingWebhook] = useState(false)
  const [botSettings, setBotSettings] = useState<TelegramBotMessageSettings>(() => {
    try {
      const s = (business as { telegramSettings?: string | null }).telegramSettings
      if (s) return JSON.parse(s) as TelegramBotMessageSettings
    } catch {}
    return {}
  })
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    setTelegramBotToken(business.telegramBotToken || '')
  }, [business.telegramBotToken])

  useEffect(() => {
    try {
      const s = (business as { telegramSettings?: string | null }).telegramSettings
      if (s) setBotSettings(JSON.parse(s) as TelegramBotMessageSettings)
    } catch {}
  }, [business])

  const loadData = () => {
    if (business.id) {
      fetch(`/api/telegram/users?businessId=${business.id}`)
        .then(res => res.json())
        .then(data => setTelegramUsers(Array.isArray(data) ? data : []))
        .catch(() => setTelegramUsers([]))
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

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden space-y-0">
      <div className="px-4 py-3">
        <h3 className="font-semibold text-foreground">Telegram</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Бот для записів та сповіщень</p>
      </div>

      <div className="px-4 pb-4 space-y-2">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block">Токен бота (з @BotFather)</label>
        <div className="flex gap-2">
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => { setTokenInput(e.target.value); setTokenError(null) }}
            placeholder={telegramBotToken ? 'Змінити токен...' : '123456789:ABCdefGHI...'}
            className="flex-1 px-3 py-2 rounded-lg border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/5 text-sm"
          />
          <Button
            onClick={saveToken}
            disabled={savingToken || !tokenInput.trim()}
            size="sm"
            className="shrink-0 bg-sky-600 hover:bg-sky-700 text-white"
          >
            {savingToken ? '...' : telegramBotToken ? 'Змінити' : 'Підключити'}
          </Button>
        </div>
        {telegramBotToken && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-green-600 dark:text-green-400">Підключено</span>
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

      {/* Повідомлення в кабінеті */}
      {telegramBotToken && (
        <div className="px-4 pb-4">
          {webhookSet === null ? (
            <p className="text-xs text-gray-500">Перевірка…</p>
          ) : webhookSet ? (
            <p className="text-xs text-green-600 dark:text-green-400">Повідомлення надходять у Соцмережі → Повідомлення</p>
          ) : (
            <Button size="sm" disabled={settingWebhook} onClick={enableMessagesInCabinet} className="bg-sky-600 hover:bg-sky-700 text-white">
              {settingWebhook ? 'Налаштування…' : 'Увімкнути повідомлення в кабінеті'}
            </Button>
          )}
        </div>
      )}

      {/* Налаштування повідомлень — згорнуто */}
      {telegramBotToken && (
        <details className="border-t border-black/10 dark:border-white/10">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
            Налаштування повідомлень бота
          </summary>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Привітання (існуючі користувачі)
              </label>
              <textarea
                value={botSettings.welcomeMessage ?? DEFAULT_WELCOME}
                onChange={(e) => setBotSettings((s) => ({ ...s, welcomeMessage: e.target.value }))}
                placeholder={DEFAULT_WELCOME}
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/5 text-sm"
              />
              <p className="text-[10px] text-gray-500 mt-1">Плейсхолдери: {'{{name}}'}, {'{{role}}'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Повідомлення для нових (без доступу)
              </label>
              <textarea
                value={botSettings.newUserMessage ?? DEFAULT_NEW_USER}
                onChange={(e) => setBotSettings((s) => ({ ...s, newUserMessage: e.target.value }))}
                placeholder={DEFAULT_NEW_USER}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Автовідповідь при надходженні повідомлення
              </label>
              <textarea
                value={botSettings.autoReplyMessage ?? DEFAULT_AUTO_REPLY}
                onChange={(e) => setBotSettings((s) => ({ ...s, autoReplyMessage: e.target.value }))}
                placeholder={DEFAULT_AUTO_REPLY}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="messagesOnlyViaButton"
                checked={botSettings.messagesOnlyViaButton !== false}
                onChange={(e) => setBotSettings((s) => ({ ...s, messagesOnlyViaButton: e.target.checked }))}
                className="w-4 h-4"
              />
              <label htmlFor="messagesOnlyViaButton" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Повідомлення тільки через кнопку — прибрати ввід тексту в рядку, приймати лише після «✉️ Написати повідомлення»
              </label>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="bookingEnabled"
                checked={!!botSettings.bookingEnabled}
                onChange={(e) => setBotSettings((s) => ({ ...s, bookingEnabled: e.target.checked }))}
                className="w-4 h-4"
              />
              <label htmlFor="bookingEnabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Запис через бота — клієнти можуть записатися до спеціаліста кнопками (без введення тексту)
              </label>
            </div>
            {botSettings.bookingEnabled && (
              <div className="mb-4 pl-6 border-l-2 border-gray-200 dark:border-gray-600">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Вибір послуги при записі
                </label>
                <div className="space-y-2">
                  {(['both', 'pricelist_only', 'simple_only'] as const).map((mode) => (
                    <label key={mode} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="bookingServiceMode"
                        checked={(botSettings.bookingServiceMode || 'both') === mode}
                        onChange={() => setBotSettings((s) => ({ ...s, bookingServiceMode: mode }))}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {mode === 'both' && 'Вибір: з прайсу або без — клієнт сам обирає'}
                        {mode === 'pricelist_only' && 'Тільки з прайсу — показувати каталог послуг'}
                        {mode === 'simple_only' && 'Тільки без послуги — консультація, слот без вибору'}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 mt-2">
                  Якщо прайс порожній, при «Тільки з прайсу» буде показано «Без послуги».
                </p>
              </div>
            )}
            <Button
              size="sm"
              disabled={savingSettings}
              onClick={async () => {
                setSavingSettings(true)
                try {
                  await onUpdate({ telegramSettings: JSON.stringify(botSettings) })
                  const { toast } = await import('@/components/ui/toast')
                  toast({ title: 'Налаштування збережено', type: 'success' })
                } catch (e: any) {
                  const { toast } = await import('@/components/ui/toast')
                  toast({ title: 'Помилка', description: e?.message, type: 'error' })
                } finally {
                  setSavingSettings(false)
                }
              }}
            >
              {savingSettings ? 'Збереження…' : 'Зберегти'}
            </Button>
          </div>
        </details>
      )}

      {/* Користувачі бота */}
      {telegramBotToken && (
      <details className="border-t border-black/10 dark:border-white/10">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
          Користувачі бота
          {telegramUsers.length > 0 && <span className="text-gray-500 ml-1">({telegramUsers.length})</span>}
        </summary>
        <div className="px-4 pb-4 pt-2">
        
        {telegramUsers.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            Немає зареєстрованих користувачів
          </p>
        ) : (
          <div className="space-y-2">
            {telegramUsers.map((user) => (
              <div key={user.id} className="p-3 rounded-lg bg-black/[0.04] dark:bg-white/[0.04]">
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
      )}
    </div>
  )
}
