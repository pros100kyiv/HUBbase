'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TelegramSettings } from './TelegramSettings'

type IntegrationsTab = 'telegram' | 'channels' | 'reminders' | 'payments'

const INTEGRATION_TABS: { id: IntegrationsTab; label: string; icon: string }[] = [
  { id: 'telegram', label: 'Telegram', icon: '📱' },
  { id: 'channels', label: 'SMS і Email', icon: '✉️' },
  { id: 'reminders', label: 'Нагадування', icon: '⏰' },
  { id: 'payments', label: 'Платежі', icon: '💳' },
]

interface IntegrationsSettingsProps {
  business: any
  onUpdate: (data: any) => Promise<void>
  onRefetchBusiness?: () => Promise<void>
}

export function IntegrationsSettings({ business, onUpdate, onRefetchBusiness }: IntegrationsSettingsProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<IntegrationsTab>('telegram')

  // SMS
  const [smsApiKey, setSmsApiKey] = useState(business?.smsApiKey || '')
  const [smsSender, setSmsSender] = useState(business?.smsSender || 'Xbase')
  const [showSmsApiKey, setShowSmsApiKey] = useState(false)

  // Email
  const [emailApiKey, setEmailApiKey] = useState(business?.emailApiKey || '')
  const [emailFrom, setEmailFrom] = useState(business?.emailFrom || '')
  const [emailFromName, setEmailFromName] = useState(business?.emailFromName || 'Xbase')
  const [showEmailApiKey, setShowEmailApiKey] = useState(false)

  // Payment
  const [paymentEnabled, setPaymentEnabled] = useState(business?.paymentEnabled || false)
  const [paymentApiKey, setPaymentApiKey] = useState(business?.paymentApiKey || '')
  const [paymentMerchantId, setPaymentMerchantId] = useState(business?.paymentMerchantId || '')
  const [showPaymentApiKey, setShowPaymentApiKey] = useState(false)

  // Reminders
  const [remindersEnabled, setRemindersEnabled] = useState(business?.remindersEnabled || false)
  const [reminderSmsEnabled, setReminderSmsEnabled] = useState(business?.reminderSmsEnabled || false)
  const [reminderEmailEnabled, setReminderEmailEnabled] = useState(business?.reminderEmailEnabled || false)
  const [reminderTelegramEnabled, setReminderTelegramEnabled] = useState(
    (business as { reminderTelegramEnabled?: boolean })?.reminderTelegramEnabled || false
  )
  const [reminderHoursBefore, setReminderHoursBefore] = useState(() => {
    try {
      if (business?.settings) {
        const s = JSON.parse(business.settings)
        if (typeof s?.reminderHoursBefore === 'number') return s.reminderHoursBefore
      }
    } catch {}
    return 24
  })
  const [reminderPushEnabled, setReminderPushEnabled] = useState(() => {
    try {
      if (business?.settings) {
        const s = JSON.parse(business.settings)
        if (typeof s?.reminderPushEnabled === 'boolean') return s.reminderPushEnabled
      }
    } catch {}
    return true
  })

  useEffect(() => {
    if (business) {
      setSmsApiKey(business.smsApiKey || '')
      setSmsSender(business.smsSender || 'Xbase')
      setEmailApiKey(business.emailApiKey || '')
      setEmailFrom(business.emailFrom || '')
      setEmailFromName(business.emailFromName || 'Xbase')
      setPaymentEnabled(business.paymentEnabled || false)
      setPaymentApiKey(business.paymentApiKey || '')
      setPaymentMerchantId(business.paymentMerchantId || '')
      setRemindersEnabled(business.remindersEnabled || false)
      setReminderSmsEnabled(business.reminderSmsEnabled || false)
      setReminderEmailEnabled(business.reminderEmailEnabled || false)
      setReminderTelegramEnabled((business as { reminderTelegramEnabled?: boolean })?.reminderTelegramEnabled || false)
      try {
        if (business.settings) {
          const s = JSON.parse(business.settings)
          if (typeof s?.reminderHoursBefore === 'number') setReminderHoursBefore(s.reminderHoursBefore)
          if (typeof s?.reminderPushEnabled === 'boolean') setReminderPushEnabled(s.reminderPushEnabled)
        }
      } catch {}
    }
  }, [business])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onUpdate({
        smsProvider: 'smsc',
        smsApiKey: smsApiKey || undefined,
        smsSender: smsSender || undefined,
        emailProvider: 'sendgrid',
        emailApiKey: emailApiKey || undefined,
        emailFrom: emailFrom || undefined,
        emailFromName: emailFromName || undefined,
        paymentEnabled,
        paymentProvider: 'liqpay',
        paymentApiKey: paymentApiKey || undefined,
        paymentMerchantId: paymentMerchantId || undefined,
        remindersEnabled,
        reminderSmsEnabled,
        reminderEmailEnabled,
        reminderTelegramEnabled,
        reminderHoursBefore: reminderHoursBefore || 24,
        reminderPushEnabled
      })
    } finally {
      setIsSaving(false)
    }
  }

  const StatusBadge = ({ configured, label }: { configured: boolean; label: string }) => (
    <span
      className={cn(
        'text-xs px-2 py-0.5 rounded-full',
        configured ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-gray-500/20 text-gray-500 dark:text-gray-400'
      )}
    >
      {configured ? 'Підключено' : label}
    </span>
  )

  const inputClass =
    'w-full px-3 py-2 text-sm rounded-lg border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/5 text-foreground'

  return (
    <div className="space-y-4">
      {/* Табі */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/5 dark:border-white/10">
        {INTEGRATION_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-white dark:bg-white/10 text-foreground shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-foreground hover:bg-black/[0.02] dark:hover:bg-white/[0.04]'
            )}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Контент за табом */}
      {activeTab === 'telegram' && business && (
        <TelegramSettings
          business={business}
          onUpdate={onUpdate}
          onRefetchBusiness={onRefetchBusiness}
        />
      )}

      {activeTab === 'channels' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Канали для відправки SMS та Email. Потрібні для нагадувань та сповіщень.</p>
          {/* SMS */}
          <details className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden" open>
            <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none select-none hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
              <span className="font-medium text-foreground">SMS</span>
              <StatusBadge configured={!!smsApiKey} label="Не налаштовано" />
            </summary>
        <div className="p-4 pt-0 space-y-3 border-t border-black/5 dark:border-white/5">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">API (SMSC.ua — login:password)</label>
            <div className="relative">
              <Input
                type={showSmsApiKey ? 'text' : 'password'}
                value={smsApiKey}
                onChange={(e) => setSmsApiKey(e.target.value)}
                placeholder="login:password"
                className={cn(inputClass, 'pr-20')}
              />
              <button
                type="button"
                onClick={() => setShowSmsApiKey(!showSmsApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-foreground"
              >
                {showSmsApiKey ? 'Сховати' : 'Показати'}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Відправник</label>
            <Input value={smsSender} onChange={(e) => setSmsSender(e.target.value)} placeholder="Xbase" className={inputClass} />
          </div>
        </div>
      </details>

          {/* Email */}
          <details className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden" open>
        <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none select-none hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
          <span className="font-medium text-foreground">Email</span>
          <StatusBadge configured={!!emailApiKey} label="Не налаштовано" />
        </summary>
        <div className="p-4 pt-0 space-y-3 border-t border-black/5 dark:border-white/5">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">API ключ (SendGrid)</label>
            <div className="relative">
              <Input
                type={showEmailApiKey ? 'text' : 'password'}
                value={emailApiKey}
                onChange={(e) => setEmailApiKey(e.target.value)}
                placeholder="SG.xxx"
                className={cn(inputClass, 'pr-20')}
              />
              <button
                type="button"
                onClick={() => setShowEmailApiKey(!showEmailApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-foreground"
              >
                {showEmailApiKey ? 'Сховати' : 'Показати'}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Відправник</label>
            <Input
              type="email"
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
              placeholder="noreply@example.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Імʼя відправника</label>
            <Input value={emailFromName} onChange={(e) => setEmailFromName(e.target.value)} placeholder="Xbase" className={inputClass} />
          </div>
        </div>
      </details>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Онлайн-оплата через LiqPay. Клієнти зможуть оплачувати при записі.</p>
          <details className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden" open>
        <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none select-none hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
          <span className="font-medium text-foreground">Платежі (LiqPay)</span>
          <StatusBadge configured={paymentEnabled && !!paymentApiKey && !!paymentMerchantId} label="Вимкнено" />
        </summary>
        <div className="p-4 pt-0 space-y-3 border-t border-black/5 dark:border-white/5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={paymentEnabled} onChange={(e) => setPaymentEnabled(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm">Увімкнути онлайн-оплату</span>
          </label>
          {paymentEnabled && (
            <>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Private Key</label>
                <div className="relative">
                  <Input
                    type={showPaymentApiKey ? 'text' : 'password'}
                    value={paymentApiKey}
                    onChange={(e) => setPaymentApiKey(e.target.value)}
                    placeholder="Приватний ключ"
                    className={cn(inputClass, 'pr-20')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPaymentApiKey(!showPaymentApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-foreground"
                  >
                    {showPaymentApiKey ? 'Сховати' : 'Показати'}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Public Key</label>
                <Input
                  value={paymentMerchantId}
                  onChange={(e) => setPaymentMerchantId(e.target.value)}
                  placeholder="Публічний ключ"
                  className={inputClass}
                />
              </div>
            </>
          )}
        </div>
      </details>
        </div>
      )}

      {activeTab === 'reminders' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Автоматичні нагадування клієнтам перед візитом. Оберіть канали та час.</p>
      <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Нагадування клієнтам</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={remindersEnabled} onChange={(e) => setRemindersEnabled(e.target.checked)} className="w-4 h-4 rounded" />
          <span className="text-sm">Відправляти нагадування про запис</span>
        </label>
        {remindersEnabled && (
          <div className="space-y-2 pl-6">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={reminderHoursBefore}
                onChange={(e) => setReminderHoursBefore(parseInt(e.target.value) || 24)}
                min={1}
                max={168}
                className={cn(inputClass, 'w-20')}
              />
              <span className="text-xs text-gray-500">годин до візиту</span>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className={cn('flex items-center gap-2 cursor-pointer', !smsApiKey && 'opacity-50')}>
                <input type="checkbox" checked={reminderSmsEnabled} onChange={(e) => setReminderSmsEnabled(e.target.checked)} disabled={!smsApiKey} className="w-4 h-4 rounded" />
                <span className="text-xs">SMS</span>
              </label>
              <label className={cn('flex items-center gap-2 cursor-pointer', !emailApiKey && 'opacity-50')}>
                <input type="checkbox" checked={reminderEmailEnabled} onChange={(e) => setReminderEmailEnabled(e.target.checked)} disabled={!emailApiKey} className="w-4 h-4 rounded" />
                <span className="text-xs">Email</span>
              </label>
              <label className={cn('flex items-center gap-2 cursor-pointer', !business?.telegramBotToken && 'opacity-50')}>
                <input type="checkbox" checked={reminderTelegramEnabled} onChange={(e) => setReminderTelegramEnabled(e.target.checked)} disabled={!business?.telegramBotToken} className="w-4 h-4 rounded" />
                <span className="text-xs">Telegram</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={reminderPushEnabled} onChange={(e) => setReminderPushEnabled(e.target.checked)} className="w-4 h-4 rounded" />
                <span className="text-xs">Push</span>
              </label>
            </div>
          </div>
        )}
      </div>
        </div>
      )}

      {activeTab !== 'telegram' && (
        <Button onClick={handleSave} disabled={isSaving} className="w-full h-11 font-medium">
          {isSaving ? 'Збереження…' : 'Зберегти налаштування'}
        </Button>
      )}
    </div>
  )
}
