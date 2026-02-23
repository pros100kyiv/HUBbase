export const dynamic = 'force-dynamic'
export const revalidate = 0
import BookingPageClient from './BookingPageClient'
import { fetchBookingBusinessBySlug } from '@/lib/booking-fetch-business'

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await params
  const slug = String(p?.slug ?? '').trim()

  // Server-side fetch — бізнес вже готовий, клієнт рендерить без чекання API
  const initialBusiness = slug ? await fetchBookingBusinessBySlug(slug) : null

  return <BookingPageClient slug={slug} initialBusiness={initialBusiness} />
}

