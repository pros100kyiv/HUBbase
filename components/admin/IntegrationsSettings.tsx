'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BotIcon, PhoneIcon, MoneyIcon, CheckIcon, XIcon, AlertCircleIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

interface IntegrationsSettingsProps {
  business: any
  onUpdate: (data: any) => Promise<void>
}

export function IntegrationsSettings({ business, onUpdate }: IntegrationsSettingsProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean, message: string }>>({})
  
  // AI Chat
  const [aiProvider, setAiProvider] = useState(business?.aiProvider || 'gemini')
  const [aiApiKey, setAiApiKey] = useState(business?.aiApiKey || '')
  const [aiModel, setAiModel] = useState(business?.aiSettings ? JSON.parse(business.aiSettings)?.model || 'gemini-pro' : 'gemini-pro')
  const [aiTemperature, setAiTemperature] = useState(business?.aiSettings ? JSON.parse(business.aiSettings)?.temperature || 0.7 : 0.7)
  const [showAiApiKey, setShowAiApiKey] = useState(false)
  
  // SMS
  const [smsProvider, setSmsProvider] = useState(business?.smsProvider || 'smsc')
  const [smsApiKey, setSmsApiKey] = useState(business?.smsApiKey || '')
  const [smsSender, setSmsSender] = useState(business?.smsSender || 'Xbase')
  const [showSmsApiKey, setShowSmsApiKey] = useState(false)
  
  // Email
  const [emailProvider, setEmailProvider] = useState(business?.emailProvider || 'sendgrid')
  const [emailApiKey, setEmailApiKey] = useState(business?.emailApiKey || '')
  const [emailFrom, setEmailFrom] = useState(business?.emailFrom || '')
  const [emailFromName, setEmailFromName] = useState(business?.emailFromName || 'Xbase')
  const [showEmailApiKey, setShowEmailApiKey] = useState(false)
  
  // Payment
  const [paymentEnabled, setPaymentEnabled] = useState(business?.paymentEnabled || false)
  const [paymentProvider, setPaymentProvider] = useState(business?.paymentProvider || 'liqpay')
  const [paymentApiKey, setPaymentApiKey] = useState(business?.paymentApiKey || '')
  const [paymentMerchantId, setPaymentMerchantId] = useState(business?.paymentMerchantId || '')
  const [showPaymentApiKey, setShowPaymentApiKey] = useState(false)
  
  // Reminders
  const [remindersEnabled, setRemindersEnabled] = useState(business?.remindersEnabled || false)
  const [reminderSmsEnabled, setReminderSmsEnabled] = useState(business?.reminderSmsEnabled || false)
  const [reminderEmailEnabled, setReminderEmailEnabled] = useState(business?.reminderEmailEnabled || false)
  const [reminderHoursBefore, setReminderHoursBefore] = useState(() => {
    try {
      if (business?.settings) {
        const s = JSON.parse(business.settings)
        if (typeof s?.reminderHoursBefore === 'number') return s.reminderHoursBefore
      }
    } catch {}
    return 24
  })
  
  // Оновлюємо стан при зміні business
  useEffect(() => {
    if (business) {
      setAiProvider(business.aiProvider || 'gemini')
      setAiApiKey(business.aiApiKey || '')
      if (business.aiSettings) {
        try {
          const settings = JSON.parse(business.aiSettings)
          setAiModel(settings.model || 'gemini-pro')
          setAiTemperature(settings.temperature || 0.7)
        } catch {
          setAiModel('gemini-pro')
          setAiTemperature(0.7)
        }
      }
      setSmsProvider(business.smsProvider || 'smsc')
      setSmsApiKey(business.smsApiKey || '')
      setSmsSender(business.smsSender || 'Xbase')
      setEmailProvider(business.emailProvider || 'sendgrid')
      setEmailApiKey(business.emailApiKey || '')
      setEmailFrom(business.emailFrom || '')
      setEmailFromName(business.emailFromName || 'Xbase')
      setPaymentEnabled(business.paymentEnabled || false)
      setPaymentProvider(business.paymentProvider || 'liqpay')
      setPaymentApiKey(business.paymentApiKey || '')
      setPaymentMerchantId(business.paymentMerchantId || '')
      setRemindersEnabled(business.remindersEnabled || false)
      setReminderSmsEnabled(business.reminderSmsEnabled || false)
      setReminderEmailEnabled(business.reminderEmailEnabled || false)
      try {
        if (business.settings) {
          const s = JSON.parse(business.settings)
          if (typeof s?.reminderHoursBefore === 'number') setReminderHoursBefore(s.reminderHoursBefore)
        }
      } catch {}
    }
  }, [business])
  
  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onUpdate({
        aiProvider,
        aiApiKey: aiApiKey || undefined,
        aiSettings: JSON.stringify({
          model: aiModel,
          temperature: parseFloat(aiTemperature.toString())
        }),
        smsProvider,
        smsApiKey: smsApiKey || undefined,
        smsSender: smsSender || undefined,
        emailProvider,
        emailApiKey: emailApiKey || undefined,
        emailFrom: emailFrom || undefined,
        emailFromName: emailFromName || undefined,
        paymentEnabled,
        paymentProvider,
        paymentApiKey: paymentApiKey || undefined,
        paymentMerchantId: paymentMerchantId || undefined,
      remindersEnabled,
      reminderSmsEnabled,
      reminderEmailEnabled,
      reminderHoursBefore: reminderHoursBefore || 24
      })
    } finally {
      setIsSaving(false)
    }
  }
  
  const testIntegration = async (type: 'ai' | 'sms' | 'email' | 'payment') => {
    setTesting(type)
    setTestResults(prev => ({ ...prev, [type]: { success: false, message: 'Тестування...' } }))
    
    try {
      if (type === 'ai') {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId: business.id,
            message: 'Привіт! Це тестовий запит.',
            sessionId: 'test_' + Date.now()
          })
        })
        const data = await response.json()
        if (data?.success && typeof data?.message === 'string') {
          const status = data?.action?.status
          if (status === 'ai_disabled') {
            setTestResults(prev => ({ ...prev, [type]: { success: false, message: 'AI чат вимкнений адміном. Увімкніть в Центрі управління.' } }))
          } else {
            setTestResults(prev => ({ ...prev, [type]: { success: true, message: 'AI endpoint відповідає. ' + data.message } }))
          }
        } else {
          setTestResults(prev => ({ ...prev, [type]: { success: false, message: data.error || 'Помилка тестування' } }))
        }
      } else if (type === 'sms') {
        // Тест SMS через API
        setTestResults(prev => ({ ...prev, [type]: { success: true, message: 'SMS налаштування збережено. Для тестування відправте тестове SMS.' } }))
      } else if (type === 'email') {
        // Тест Email через API
        setTestResults(prev => ({ ...prev, [type]: { success: true, message: 'Email налаштування збережено. Для тестування відправте тестовий email.' } }))
      } else if (type === 'payment') {
        // Тест Payment через API
        setTestResults(prev => ({ ...prev, [type]: { success: true, message: 'Платежі налаштовано. Створіть тестовий платіж для перевірки.' } }))
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, [type]: { success: false, message: 'Помилка: ' + (error instanceof Error ? error.message : 'Невідома помилка') } }))
    } finally {
      setTesting(null)
    }
  }
  
  const getStatusIcon = (enabled: boolean, configured: boolean) => {
    if (!enabled) return <XIcon className="w-4 h-4 text-gray-400" />
    if (configured) return <CheckIcon className="w-4 h-4 text-green-500" />
    return <AlertCircleIcon className="w-4 h-4 text-yellow-500" />
  }
  
  return (
    <div className="space-y-6">
      {/* Статус інтеграцій */}
      <div className="card-candy p-6 bg-gradient-to-br from-candy-purple/10 to-candy-blue/10">
        <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">Статус інтеграцій</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            {getStatusIcon(business?.aiChatEnabled === true, !!aiApiKey)}
            <span className="text-xs font-bold">AI Чат</span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(true, !!smsApiKey)}
            <span className="text-xs font-bold">SMS</span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(true, !!emailApiKey)}
            <span className="text-xs font-bold">Email</span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(paymentEnabled, !!paymentApiKey && !!paymentMerchantId)}
            <span className="text-xs font-bold">Платежі</span>
          </div>
        </div>
      </div>

      {/* AI Chat */}
      <div className="card-candy p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BotIcon className="w-5 h-5 text-candy-purple" />
            <h3 className="text-lg font-black text-gray-900 dark:text-white">AI Чат</h3>
          </div>
          {getStatusIcon(business?.aiChatEnabled === true, !!aiApiKey)}
        </div>
        <div className="space-y-4">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Вмикання/вимикання AI чату керується через Центр управління (адмін). Тут можна лише налаштувати ключ/модель.
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Провайдер</label>
            <select
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-candy-xs bg-white dark:bg-gray-700"
            >
              <option value="gemini">Google Gemini</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
              API Ключ
              <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-candy-blue ml-2 underline">
                Отримати ключ
              </a>
            </label>
            <div className="relative">
              <Input
                type={showAiApiKey ? "text" : "password"}
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="Введіть API ключ"
                className="text-xs pr-10"
              />
              <button
                type="button"
                onClick={() => setShowAiApiKey(!showAiApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
              >
                {showAiApiKey ? 'Сховати' : 'Показати'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Модель</label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-candy-xs bg-white dark:bg-gray-700"
              >
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                Temperature: {aiTemperature}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={aiTemperature}
                onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
          <Button
            onClick={() => testIntegration('ai')}
            disabled={testing === 'ai' || !aiApiKey}
            className="w-full bg-candy-purple/10 text-candy-purple border border-candy-purple hover:bg-candy-purple hover:text-white"
          >
            {testing === 'ai' ? 'Тестування...' : 'Тестувати AI endpoint'}
          </Button>
          {testResults.ai && (
            <div className={cn(
              "p-3 rounded-candy-xs text-xs",
              testResults.ai.success ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
            )}>
              {testResults.ai.message}
            </div>
          )}
        </div>
      </div>
      
      {/* SMS */}
      <div className="card-candy p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PhoneIcon className="w-5 h-5 text-candy-blue" />
            <h3 className="text-lg font-black text-gray-900 dark:text-white">SMS Розсилки</h3>
          </div>
          {getStatusIcon(true, !!smsApiKey)}
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Провайдер</label>
            <select
              value={smsProvider}
              onChange={(e) => setSmsProvider(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-candy-xs bg-white dark:bg-gray-700"
            >
              <option value="smsc">SMSC.ua</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              <a href="https://smsc.ua" target="_blank" rel="noopener noreferrer" className="text-candy-blue underline">
                Зареєструватися на SMSC.ua
              </a>
            </p>
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">API Ключ (login:password)</label>
            <div className="relative">
              <Input
                type={showSmsApiKey ? "text" : "password"}
                value={smsApiKey}
                onChange={(e) => setSmsApiKey(e.target.value)}
                placeholder="login:password"
                className="text-xs pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSmsApiKey(!showSmsApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
              >
                {showSmsApiKey ? 'Сховати' : 'Показати'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Формат: ваш_логін:ваш_пароль</p>
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Відправник (назва)</label>
            <Input
              value={smsSender}
              onChange={(e) => setSmsSender(e.target.value)}
              placeholder="Xbase"
              className="text-xs"
            />
          </div>
        </div>
      </div>
      
      {/* Email */}
      <div className="card-candy p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PhoneIcon className="w-5 h-5 text-candy-mint" />
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Email Розсилки</h3>
          </div>
          {getStatusIcon(true, !!emailApiKey)}
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Провайдер</label>
            <select
              value={emailProvider}
              onChange={(e) => setEmailProvider(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-candy-xs bg-white dark:bg-gray-700"
            >
              <option value="sendgrid">SendGrid</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              <a href="https://sendgrid.com" target="_blank" rel="noopener noreferrer" className="text-candy-blue underline">
                Зареєструватися на SendGrid
              </a>
            </p>
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">API Ключ</label>
            <div className="relative">
              <Input
                type={showEmailApiKey ? "text" : "password"}
                value={emailApiKey}
                onChange={(e) => setEmailApiKey(e.target.value)}
                placeholder="Введіть API ключ"
                className="text-xs pr-10"
              />
              <button
                type="button"
                onClick={() => setShowEmailApiKey(!showEmailApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
              >
                {showEmailApiKey ? 'Сховати' : 'Показати'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Отримайте API ключ в SendGrid → Settings → API Keys</p>
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Email відправника</label>
            <Input
              type="email"
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
              placeholder="noreply@example.com"
              className="text-xs"
            />
            <p className="text-xs text-gray-500 mt-1">Email має бути підтверджений в SendGrid</p>
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Ім'я відправника</label>
            <Input
              value={emailFromName}
              onChange={(e) => setEmailFromName(e.target.value)}
              placeholder="Xbase"
              className="text-xs"
            />
          </div>
        </div>
      </div>
      
      {/* Payment */}
      <div className="card-candy p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MoneyIcon className="w-5 h-5 text-candy-pink" />
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Платежі</h3>
          </div>
          {getStatusIcon(paymentEnabled, !!paymentApiKey && !!paymentMerchantId)}
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="paymentEnabled"
              checked={paymentEnabled}
              onChange={(e) => setPaymentEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="paymentEnabled" className="text-sm font-bold">Увімкнути платежі</label>
          </div>
          {paymentEnabled && (
            <>
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Провайдер</label>
                <select
                  value={paymentProvider}
                  onChange={(e) => setPaymentProvider(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-candy-xs bg-white dark:bg-gray-700"
                >
                  <option value="liqpay">LiqPay</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  <a href="https://www.liqpay.ua" target="_blank" rel="noopener noreferrer" className="text-candy-blue underline">
                    Зареєструватися на LiqPay
                  </a>
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Private Key (API Ключ)</label>
                <div className="relative">
                  <Input
                    type={showPaymentApiKey ? "text" : "password"}
                    value={paymentApiKey}
                    onChange={(e) => setPaymentApiKey(e.target.value)}
                    placeholder="Введіть Private Key"
                    className="text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPaymentApiKey(!showPaymentApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showPaymentApiKey ? 'Сховати' : 'Показати'}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Public Key (Merchant ID)</label>
                <Input
                  value={paymentMerchantId}
                  onChange={(e) => setPaymentMerchantId(e.target.value)}
                  placeholder="Введіть Public Key"
                  className="text-xs"
                />
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Reminders */}
      <div className="card-candy p-6">
        <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">Автоматичні нагадування</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="remindersEnabled"
              checked={remindersEnabled}
              onChange={(e) => setRemindersEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="remindersEnabled" className="text-sm font-bold">Увімкнути нагадування</label>
          </div>
          {remindersEnabled && (
            <>
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                  Нагадувати за (годин до запису)
                </label>
                <Input
                  type="number"
                  value={reminderHoursBefore}
                  onChange={(e) => setReminderHoursBefore(parseInt(e.target.value) || 24)}
                  min="1"
                  max="168"
                  className="text-xs"
                />
                <p className="text-xs text-gray-500 mt-1">Рекомендовано: 24 години</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="reminderSmsEnabled"
                    checked={reminderSmsEnabled}
                    onChange={(e) => setReminderSmsEnabled(e.target.checked)}
                    disabled={!smsApiKey}
                    className="w-4 h-4"
                  />
                  <label htmlFor="reminderSmsEnabled" className={cn(
                    "text-sm font-bold",
                    !smsApiKey && "text-gray-400"
                  )}>
                    SMS нагадування
                    {!smsApiKey && " (спочатку налаштуйте SMS)"}
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="reminderEmailEnabled"
                    checked={reminderEmailEnabled}
                    onChange={(e) => setReminderEmailEnabled(e.target.checked)}
                    disabled={!emailApiKey}
                    className="w-4 h-4"
                  />
                  <label htmlFor="reminderEmailEnabled" className={cn(
                    "text-sm font-bold",
                    !emailApiKey && "text-gray-400"
                  )}>
                    Email нагадування
                    {!emailApiKey && " (спочатку налаштуйте Email)"}
                  </label>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Кнопка збереження */}
      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 bg-gradient-to-r from-candy-purple to-candy-blue text-white hover:shadow-soft-xl"
        >
          {isSaving ? 'Збереження...' : 'Зберегти всі налаштування'}
        </Button>
      </div>
      
      {/* Інформаційна панель */}
      <div className="card-candy p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-2">
          <AlertCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700 dark:text-blue-300">
            <p className="font-bold mb-1">Важливо:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>API ключі зберігаються в зашифрованому вигляді</li>
              <li>Після збереження налаштувань перезавантажте сторінку</li>
              <li>Для тестування AI чату використовуйте кнопку "Тестувати"</li>
              <li>Переконайтеся, що всі API ключі валідні перед збереженням</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
