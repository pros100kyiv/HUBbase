/**
 * Клієнтська логіка підписок (без залежності від Prisma).
 * Використовується на сторінці Підписка в кабінеті.
 */

export type SubscriptionPlanKey = 'FREE' | 'START' | 'BUSINESS' | 'PRO'

export const SUBSCRIPTION_PLAN_LABELS: Record<SubscriptionPlanKey, string> = {
  FREE: 'Безкоштовний',
  START: 'Старт',
  BUSINESS: 'Бізнес',
  PRO: 'Про',
}

/** Короткий опис тарифу — для кого і навіщо */
export const SUBSCRIPTION_PLAN_DESCRIPTIONS: Record<SubscriptionPlanKey, string> = {
  FREE: 'Після trial — базовий доступ: один спеціаліст, записи, клієнти, Telegram. Ідеально щоб спробувати платформу.',
  START: 'Для соло-майстра або міні-студії: все необхідне для щоденної роботи без аналітики та розширень.',
  BUSINESS: 'Для салону чи барбершопу з командою: до 5 спеціалістів, аналітика, звіти, краще контролюйте дохід і завантаженість.',
  PRO: 'Максимум можливостей: велика команда, Instagram у кабінеті, AI-помічник для клієнтів, все в одному місці.',
}

/** Фішки платформи — показуємо в блоці «Що ви отримуєте» */
export const PLATFORM_FEATURES = [
  { id: 'booking', label: 'Онлайн-бронювання', desc: 'Клієнти записуються за посиланням або QR без дзвінків' },
  { id: 'telegram', label: 'Telegram-бот', desc: 'Нагадування, розсилки та сповіщення про нові записи' },
  { id: 'calendar', label: 'Єдиний календар', desc: 'Записи, графіки майстрів і робочі години в одному місці' },
  { id: 'clients', label: 'База клієнтів', desc: 'Історія візитів, нотатки, сегменти для розсилок' },
  { id: 'pwa', label: 'Додаток на телефон', desc: 'Встановіть Xbase на екран — швидкий доступ без браузера' },
  { id: 'branding', label: 'Свій бренд', desc: 'Кольори, назва, сторінка бронювання під ваш салон' },
] as const

const LIMITS: Record<
  SubscriptionPlanKey,
  { maxMasters: number; hasAnalytics: boolean; hasTelegram: boolean; hasInstagram: boolean; hasAiChat: boolean }
> = {
  FREE: { maxMasters: 1, hasAnalytics: false, hasTelegram: true, hasInstagram: false, hasAiChat: false },
  START: { maxMasters: 1, hasAnalytics: false, hasTelegram: true, hasInstagram: false, hasAiChat: false },
  BUSINESS: { maxMasters: 5, hasAnalytics: true, hasTelegram: true, hasInstagram: false, hasAiChat: false },
  PRO: { maxMasters: 50, hasAnalytics: true, hasTelegram: true, hasInstagram: true, hasAiChat: true },
}

export function getSubscriptionPlanLimits(plan: string) {
  const key = plan as SubscriptionPlanKey
  return LIMITS[key] ?? LIMITS.FREE
}

export type SubscriptionStateClient = {
  plan: string
  isOnTrial: boolean
  trialEndsAt: Date | null
  trialDaysLeft: number | null
  isExpired: boolean
  status: 'trial' | 'active' | 'expired' | 'cancelled'
  limits: (typeof LIMITS)[SubscriptionPlanKey]
}

export function getSubscriptionStateClient(
  plan: string,
  trialEndsAt: Date | null,
  subscriptionStatus: string | null
): SubscriptionStateClient {
  const planKey = (plan || 'FREE') as SubscriptionPlanKey
  const limits = getSubscriptionPlanLimits(plan)

  const now = new Date()
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null
  const hasTrial = trialEnd !== null
  const isOnTrial = hasTrial && trialEnd > now && planKey === 'FREE'
  const trialDaysLeft =
    trialEnd && trialEnd > now ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : null
  const isExpired = hasTrial && trialEnd !== null && trialEnd <= now && planKey === 'FREE'

  let status: SubscriptionStateClient['status'] = 'active'
  if (subscriptionStatus === 'cancelled') status = 'cancelled'
  else if (isExpired) status = 'expired'
  else if (isOnTrial) status = 'trial'

  return {
    plan: planKey,
    isOnTrial,
    trialEndsAt: trialEnd,
    trialDaysLeft,
    isExpired,
    status,
    limits,
  }
}
