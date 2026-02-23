/**
 * Server-side fetch для сторінки бронювання.
 * Бізнес завантажується на сервері — клієнт отримує дані одразу, без додаткового round-trip.
 */
import { prisma } from '@/lib/prisma'
import { jsonSafe } from '@/lib/utils/json'

const businessPublicSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logo: true,
  primaryColor: true,
  secondaryColor: true,
  backgroundColor: true,
  surfaceColor: true,
  isActive: true,
  businessCardBackgroundImage: true,
  slogan: true,
  additionalInfo: true,
  socialMedia: true,
  workingHours: true,
  location: true,
  niche: true,
  customNiche: true,
  businessIdentifier: true,
  profileCompleted: true,
  avatar: true,
  aiChatEnabled: true,
  aiProvider: true,
  aiSettings: true,
  remindersEnabled: true,
  settings: true,
  subscriptionPlan: true,
  trialEndsAt: true,
  subscriptionStatus: true,
  subscriptionCurrentPeriodEnd: true,
}

export type BookingBusiness = {
  id: string
  name: string
  slug: string
  description?: string | null
  logo?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  backgroundColor?: string | null
  surfaceColor?: string | null
  isActive?: boolean | null
  businessCardBackgroundImage?: string | null
  slogan?: string | null
  additionalInfo?: string | null
  socialMedia?: string | null
  workingHours?: string | null
  location?: string | null
  niche?: string | null
  customNiche?: string | null
  businessIdentifier?: string | null
  profileCompleted?: boolean | null
  avatar?: string | null
  aiChatEnabled?: boolean | null
  aiProvider?: string | null
  aiSettings?: string | null
  remindersEnabled?: boolean | null
  settings?: string | null
  subscriptionPlan?: string | null
  trialEndsAt?: Date | string | null
  subscriptionStatus?: string | null
  subscriptionCurrentPeriodEnd?: Date | string | null
}

/**
 * Завантажує бізнес за slug для публічної сторінки бронювання.
 * Викликати тільки на сервері (RSC, Route Handler).
 */
export async function fetchBookingBusinessBySlug(slug: string): Promise<BookingBusiness | null> {
  if (!slug || typeof slug !== 'string') return null
  const s = slug.trim()
  if (!s) return null

  const business = await prisma.business.findUnique({
    where: { slug: s },
    select: businessPublicSelect,
  })

  if (!business || business.isActive === false) return null

  return jsonSafe(business) as BookingBusiness
}
