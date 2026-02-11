'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useBooking } from '@/contexts/BookingContext'
import { LandingStep } from '@/components/booking/LandingStep'

const ServiceStep = dynamic(
  () => import('@/components/booking/ServiceStep').then((m) => ({ default: m.ServiceStep })),
  { ssr: false }
)
const MasterStep = dynamic(
  () => import('@/components/booking/MasterStep').then((m) => ({ default: m.MasterStep })),
  { ssr: false }
)
const TimeStep = dynamic(
  () => import('@/components/booking/TimeStep').then((m) => ({ default: m.TimeStep })),
  { ssr: false }
)
const FinalStep = dynamic(
  () => import('@/components/booking/FinalStep').then((m) => ({ default: m.FinalStep })),
  { ssr: false }
)

interface Business {
  id: string
  name: string
  slug: string
  primaryColor?: string
  secondaryColor?: string
  backgroundColor?: string
  surfaceColor?: string
}

export default function BookingPage() {
  const params = useParams()
  const slug = params.slug as string
  const { state, setBusinessId } = useBooking()
  const [business, setBusiness] = useState<Business | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const loadedSlugRef = useRef<string | null>(null)

  useEffect(() => {
    if (!slug) {
      setIsLoading(false)
      return
    }

    // Якщо вже завантажено для цього slug, не завантажуємо знову
    if (loadedSlugRef.current === slug) {
      return
    }

    loadedSlugRef.current = slug
    setIsLoading(true)
    
    fetch(`/api/business/${slug}`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Business not found')
        }
        return res.json()
      })
      .then(data => {
        // Перевіряємо, чи slug не змінився під час завантаження
        if (data.business && loadedSlugRef.current === slug) {
          setBusiness(data.business)
          setBusinessId(data.business.id)
        }
        setIsLoading(false)
      })
      .catch(error => {
        console.error('Error loading business:', error)
        if (loadedSlugRef.current === slug) {
          loadedSlugRef.current = null
          setBusiness(null)
          setBusinessId(null)
        }
        setIsLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const steps = [
    <LandingStep key="landing" business={business} />,
    <ServiceStep key="service" businessId={business?.id} />,
    <MasterStep key="master" businessId={business?.id} />,
    <TimeStep key="time" businessId={business?.id} />,
    <FinalStep key="final" businessId={business?.id} />,
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

  return (
    <div className="min-h-screen">
      {steps[state.step]}
    </div>
  )
}

