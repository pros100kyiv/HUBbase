'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useBooking } from '@/contexts/BookingContext'
import { LandingStep } from '@/components/booking/LandingStep'
import { ServiceStep } from '@/components/booking/ServiceStep'
import { MasterStep } from '@/components/booking/MasterStep'
import { TimeStep } from '@/components/booking/TimeStep'
import { FinalStep } from '@/components/booking/FinalStep'

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
        setIsLoading(false)
        if (loadedSlugRef.current === slug) {
          loadedSlugRef.current = null
        }
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

