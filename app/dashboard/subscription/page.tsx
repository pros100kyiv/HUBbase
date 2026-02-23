'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import {
  SUBSCRIPTION_PLAN_LABELS,
  SUBSCRIPTION_PLAN_DESCRIPTIONS,
  getSubscriptionPlanLimits,
  getSubscriptionStateClient,
  PLATFORM_FEATURES,
} from '@/lib/subscription-client'
import type { SubscriptionPlanKey } from '@/lib/subscription-client'
import {
  CreditCardIcon,
  CheckIcon,
  CalendarIcon,
  UsersIcon,
  ChartIcon,
  ShareIcon,
  TelegramIcon,
  QRIcon,
  ImageIcon,
  LightBulbIcon,
  ChevronRightIcon,
} from '@/components/icons'
import { cn } from '@/lib/utils'
import { getBusinessData } from '@/lib/business-storage'

const PLAN_ORDER: SubscriptionPlanKey[] = ['FREE', 'START', 'BUSINESS', 'PRO']

const FEATURE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  booking: QRIcon,
  telegram: TelegramIcon,
  calendar: CalendarIcon,
  clients: UsersIcon,
  pwa: ShareIcon,
  branding: ImageIcon,
}

export default function SubscriptionPage() {
  const router = useRouter()
  const [business, setBusiness] = useState<{
    id: string
    subscriptionPlan?: string
    trialEndsAt?: string | null
    subscriptionStatus?: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [mastersCount, setMastersCount] = useState<number>(0)

  useEffect(() => {
    const businessData = getBusinessData()
    if (!businessData) {
      router.push('/login')
      return
    }
    try {
      const parsed = JSON.parse(businessData)
      setBusiness(parsed)
    } catch {
      router.push('/login')
    }
  }, [router])

  const [subscriptionState, setSubscriptionState] = useState<ReturnType<typeof getSubscriptionStateClient> | null>(null)

  useEffect(() => {
    if (!business?.id) return
    const plan = business.subscriptionPlan || 'FREE'
    setSubscriptionState(
      getSubscriptionStateClient(
        plan,
        business.trialEndsAt ? new Date(business.trialEndsAt) : null,
        business.subscriptionStatus ?? null
      )
    )
  }, [business?.id, business?.subscriptionPlan, business?.trialEndsAt, business?.subscriptionStatus])

  useEffect(() => {
    if (!business?.id) return
    setLoading(true)
    Promise.all([
      fetch(`/api/business/${business.id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/masters?businessId=${business.id}`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([businessRes, masters]) => {
        if (businessRes?.business) {
          const b = businessRes.business
          setBusiness((prev) => (prev ? { ...prev, ...b } : null))
          setSubscriptionState(
            getSubscriptionStateClient(
              b.subscriptionPlan || 'FREE',
              b.trialEndsAt ? new Date(b.trialEndsAt) : null,
              b.subscriptionStatus ?? null
            )
          )
        }
        setMastersCount(Array.isArray(masters) ? masters.length : 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [business?.id])

  if (!business) return null

  const plan = (business.subscriptionPlan || 'FREE') as SubscriptionPlanKey
  const labels = SUBSCRIPTION_PLAN_LABELS
  const descriptions = SUBSCRIPTION_PLAN_DESCRIPTIONS
  const limits = getSubscriptionPlanLimits(plan)
  const mastersPercent = limits.maxMasters > 0 ? Math.min(100, (mastersCount / limits.maxMasters) * 100) : 0

  return (
    <div className="min-w-0 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <CreditCardIcon className="w-7 h-7" />
          Підписка
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Ваш тариф, можливості платформи та умови. Змінити план може адміністратор — зверніться до підтримки.
        </p>
      </div>

      {loading ? (
        <div className="card-glass rounded-xl p-8 text-gray-400 text-center">Завантаження...</div>
      ) : (
        <div className="space-y-8">
          {/* Поточний план — герой-блок */}
          <div className="card-glass rounded-2xl p-6 md:p-8 border border-white/10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Поточний тариф</p>
                <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                  <span className="px-3 py-1 rounded-lg bg-white/15 text-white">
                    {labels[plan] ?? plan}
                  </span>
                  {subscriptionState?.isOnTrial && (
                    <span className="px-3 py-1 rounded-lg bg-amber-500/25 text-amber-300 border border-amber-500/40 text-sm font-medium">
                      Trial
                    </span>
                  )}
                </h2>
                <p className="text-gray-400 text-sm mt-2 max-w-xl">
                  {descriptions[plan]}
                </p>
              </div>
              {subscriptionState?.isOnTrial && subscriptionState.trialEndsAt && (
                <div className="px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-left">
                  <p className="text-amber-200 font-medium text-sm">Trial до {format(subscriptionState.trialEndsAt, 'd MMMM yyyy', { locale: uk })}</p>
                  {subscriptionState.trialDaysLeft != null && (
                    <p className="text-amber-300/90 text-xs mt-0.5">Залишилось днів: {subscriptionState.trialDaysLeft}</p>
                  )}
                </div>
              )}
              {subscriptionState?.status === 'expired' && (
                <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm font-medium">
                  Trial закінчився
                </div>
              )}
            </div>

            {/* Прогрес: спеціалісти */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Спеціалістів у профілі</span>
                <span className={cn(
                  "font-medium",
                  mastersCount > limits.maxMasters ? "text-amber-400" : "text-gray-300"
                )}>
                  {mastersCount} з {limits.maxMasters}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    mastersCount > limits.maxMasters ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min(100, mastersPercent)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Що включено в ваш тариф */}
          <div className="card-glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CheckIcon className="w-5 h-5 text-emerald-400" />
              Що включено в ваш тариф
            </h2>
            <ul className="grid sm:grid-cols-2 gap-3 text-gray-300">
              <li className="flex items-center gap-2">
                {limits.maxMasters >= mastersCount ? (
                  <CheckIcon className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <span className="w-5 h-5 flex-shrink-0 text-amber-400">!</span>
                )}
                <span>До {limits.maxMasters} спеціалістів</span>
              </li>
              <li className="flex items-center gap-2">
                {limits.hasAnalytics ? <CheckIcon className="w-5 h-5 text-emerald-400 flex-shrink-0" /> : <span className="w-5 h-5 flex-shrink-0 text-gray-500">—</span>}
                <span>Аналітика та звіти</span>
              </li>
              <li className="flex items-center gap-2">
                {limits.hasTelegram ? <CheckIcon className="w-5 h-5 text-emerald-400 flex-shrink-0" /> : <span className="w-5 h-5 flex-shrink-0 text-gray-500">—</span>}
                <span>Telegram-бот та сповіщення</span>
              </li>
              <li className="flex items-center gap-2">
                {limits.hasInstagram ? <CheckIcon className="w-5 h-5 text-emerald-400 flex-shrink-0" /> : <span className="w-5 h-5 flex-shrink-0 text-gray-500">—</span>}
                <span>Instagram у кабінеті</span>
              </li>
              <li className="flex items-center gap-2">
                {limits.hasAiChat ? <CheckIcon className="w-5 h-5 text-emerald-400 flex-shrink-0" /> : <span className="w-5 h-5 flex-shrink-0 text-gray-500">—</span>}
                <span>AI-помічник для клієнтів</span>
              </li>
            </ul>
          </div>

          {/* Фішки платформи */}
          <div className="card-glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <LightBulbIcon className="w-5 h-5 text-amber-400" />
              Можливості платформи
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Це вже є у всіх тарифах — користуйтесь на повну.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PLATFORM_FEATURES.map((f) => {
                const Icon = FEATURE_ICONS[f.id] || CreditCardIcon
                return (
                  <div
                    key={f.id}
                    className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-white/80" />
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">{f.label}</p>
                        <p className="text-gray-400 text-xs mt-0.5">{f.desc}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Порівняння тарифів */}
          <div className="card-glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Усі тарифи</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Тариф</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Спеціалістів</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Аналітика</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Telegram</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Instagram</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">AI-чат</th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_ORDER.map((p) => {
                    const lim = getSubscriptionPlanLimits(p)
                    const isCurrent = p === plan
                    return (
                      <tr
                        key={p}
                        className={cn(
                          "border-b border-white/5",
                          isCurrent && "bg-white/5"
                        )}
                      >
                        <td className="py-3 px-2">
                          <span className={cn(
                            "font-medium",
                            isCurrent ? "text-white" : "text-gray-300"
                          )}>
                            {labels[p]}
                            {isCurrent && <span className="ml-1 text-xs text-emerald-400">(ваш)</span>}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-gray-300">{lim.maxMasters}</td>
                        <td className="py-3 px-2">{lim.hasAnalytics ? <CheckIcon className="w-4 h-4 text-emerald-400" /> : <span className="text-gray-600">—</span>}</td>
                        <td className="py-3 px-2">{lim.hasTelegram ? <CheckIcon className="w-4 h-4 text-emerald-400" /> : <span className="text-gray-600">—</span>}</td>
                        <td className="py-3 px-2">{lim.hasInstagram ? <CheckIcon className="w-4 h-4 text-emerald-400" /> : <span className="text-gray-600">—</span>}</td>
                        <td className="py-3 px-2">{lim.hasAiChat ? <CheckIcon className="w-4 h-4 text-emerald-400" /> : <span className="text-gray-600">—</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* CTA */}
          <div className="card-glass rounded-xl p-6 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-white">Потрібен інший тариф?</p>
              <p className="text-gray-400 text-sm mt-0.5">
                Змінити план або продовжити trial може адміністратор платформи. Напишіть у підтримку.
              </p>
            </div>
            <a
              href="mailto:support@xbase.online"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-medium text-sm transition-colors shrink-0"
            >
              Зв’язатися з підтримкою
              <ChevronRightIcon className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
