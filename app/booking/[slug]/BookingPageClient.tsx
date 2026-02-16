'use client'

import nextDynamic from 'next/dynamic'
import { useEffect, useState, useRef } from 'react'
import { useBooking } from '@/contexts/BookingContext'
import { LandingStep } from '@/components/booking/LandingStep'
import { parseBookingTimeZone } from '@/lib/utils/booking-settings'

const ServiceStep = nextDynamic(
  () => import('@/components/booking/ServiceStep').then((m) => ({ default: m.ServiceStep })),
  { ssr: false }
)
const MasterStep = nextDynamic(
  () => import('@/components/booking/MasterStep').then((m) => ({ default: m.MasterStep })),
  { ssr: false }
)
const TimeStep = nextDynamic(
  () => import('@/components/booking/TimeStep').then((m) => ({ default: m.TimeStep })),
  { ssr: false }
)
const FinalStep = nextDynamic(
  () => import('@/components/booking/FinalStep').then((m) => ({ default: m.FinalStep })),
  { ssr: false }
)
const CompleteStep = nextDynamic(
  () => import('@/components/booking/CompleteStep').then((m) => ({ default: m.CompleteStep })),
  { ssr: false }
)

interface Business {
  id: string
  name: string
  slug: string
  settings?: string | null
  primaryColor?: string
  secondaryColor?: string
  backgroundColor?: string
  surfaceColor?: string
  description?: string | null
  logo?: string | null
  avatar?: string | null
  businessCardBackgroundImage?: string | null
  slogan?: string | null
  additionalInfo?: string | null
  socialMedia?: string | null
  location?: string | null
}

export default function BookingPageClient({ slug }: { slug: string }) {
  const { state, setBusinessId } = useBooking()
  const [business, setBusiness] = useState<Business | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reloadNonce, setReloadNonce] = useState(0)
  const activeSlugRef = useRef<string | null>(null)

  useEffect(() => {
    if (!slug) {
      setIsLoading(false)
      return
    }
    activeSlugRef.current = slug

    const ac = new AbortController()
    setIsLoading(true)

    // cache: 'no-store' to always show fresh business card changes
    fetch(`/api/business/${encodeURIComponent(slug)}?t=${Date.now()}`, { signal: ac.signal, cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Business not found')
        return res.json()
      })
      .then((data) => {
        if (data.business && activeSlugRef.current === slug) {
          setBusiness(data.business)
          setBusinessId(data.business.id)
        }
        setIsLoading(false)
      })
      .catch((error) => {
        if (ac.signal.aborted) return
        console.error('Error loading business:', error)
        if (activeSlugRef.current === slug) {
          setBusiness(null)
          setBusinessId(null)
        }
        setIsLoading(false)
      })

    return () => ac.abort()
  }, [slug, reloadNonce, setBusinessId])

  // Listen for business card updates from dashboard (other tab)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!slug) return
    const handler = (e: StorageEvent) => {
      if (!e.key) return
      if (e.key === `booking_business_updated:${slug}`) {
        setReloadNonce((n) => n + 1)
        return
      }
      // Fallback: if dashboard signals by internal business id.
      if (business?.id && e.key === `booking_business_updated:${business.id}`) {
        setReloadNonce((n) => n + 1)
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [slug, business?.id])

  const businessTimeZone = parseBookingTimeZone(business?.settings ?? null)

  const steps = [
    <LandingStep key="landing" business={business} />,
    <MasterStep key="master" businessId={business?.id} />,
    <TimeStep key="time" businessId={business?.id} />,
    <ServiceStep key="service" businessId={business?.id} />,
    <FinalStep key="final" businessId={business?.id} />,
    <CompleteStep
      key="complete"
      businessName={business?.name}
      businessLocation={business?.location ?? null}
      timeZone={businessTimeZone}
    />,
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Завантаження...</p>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Бізнес не знайдено</p>
      </div>
    )
  }

  return <div className="min-h-screen">{steps[state.step]}</div>
}

