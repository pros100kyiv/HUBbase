export const dynamic = 'force-dynamic'
export const revalidate = 0
import BookingPageClient from './BookingPageClient'

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await params
  const slug = String(p?.slug ?? '').trim()

  // Client component renders the actual multi-step flow.
  return <BookingPageClient slug={slug} />
}

