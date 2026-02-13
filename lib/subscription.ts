/**
 * Логіка підписок та trial для бізнесів.
 * Trial 14 днів з моменту реєстрації; тарифи: FREE, START, BUSINESS, PRO.
 */

import { addDays } from 'date-fns'
import type { SubscriptionPlan } from '@prisma/client'

export const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '14', 10) || 14

export const SUBSCRIPTION_PLAN_LABELS: Record<SubscriptionPlan, string> = {
  FREE: 'Безкоштовний',
  START: 'Старт',
  BUSINESS: 'Бізнес',
  PRO: 'Про',
}

export const SUBSCRIPTION_PLAN_LIMITS: Record<
  SubscriptionPlan,
  { maxMasters: number; hasAnalytics: boolean; hasTelegram: boolean; hasInstagram: boolean; hasAiChat: boolean }
> = {
  FREE: { maxMasters: 1, hasAnalytics: false, hasTelegram: true, hasInstagram: false, hasAiChat: false },
  START: { maxMasters: 1, hasAnalytics: false, hasTelegram: true, hasInstagram: false, hasAiChat: false },
  BUSINESS: { maxMasters: 5, hasAnalytics: true, hasTelegram: true, hasInstagram: false, hasAiChat: false },
  PRO: { maxMasters: 50, hasAnalytics: true, hasTelegram: true, hasInstagram: true, hasAiChat: true },
}

export type SubscriptionState = {
  plan: SubscriptionPlan
  isOnTrial: boolean
  trialEndsAt: Date | null
  trialDaysLeft: number | null
  isExpired: boolean
  status: 'trial' | 'active' | 'expired' | 'cancelled'
  limits: (typeof SUBSCRIPTION_PLAN_LIMITS)[SubscriptionPlan]
}

/**
 * Повертає дату закінчення trial при реєстрації (now + TRIAL_DAYS).
 */
export function getTrialEndDate(): Date {
  return addDays(new Date(), TRIAL_DAYS)
}

/**
 * Обчислює стан підписки для бізнесу.
 */
export function getSubscriptionState(
  plan: SubscriptionPlan,
  trialEndsAt: Date | null,
  subscriptionStatus: string | null
): SubscriptionState {
  const now = new Date()
  const limits = SUBSCRIPTION_PLAN_LIMITS[plan]

  const hasTrial = trialEndsAt != null
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null
  const isOnTrial = hasTrial && trialEnd !== null && trialEnd > now && plan === 'FREE'
  const trialDaysLeft =
    trialEnd && trialEnd > now ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : null
  const isExpired = hasTrial && trialEnd !== null && trialEnd <= now && plan === 'FREE'

  let status: SubscriptionState['status'] = 'active'
  if (subscriptionStatus === 'cancelled') status = 'cancelled'
  else if (isExpired) status = 'expired'
  else if (isOnTrial) status = 'trial'

  return {
    plan,
    isOnTrial,
    trialEndsAt: trialEnd,
    trialDaysLeft,
    isExpired,
    status,
    limits,
  }
}

/**
 * Перевіряє, чи бізнес може використовувати функціонал (наприклад, додати ще одного майстра).
 */
export function canAddMaster(currentMastersCount: number, plan: SubscriptionPlan): boolean {
  return currentMastersCount < SUBSCRIPTION_PLAN_LIMITS[plan].maxMasters
}
