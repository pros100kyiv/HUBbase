'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Business {
  id: string
  name: string
  slug?: string
  email?: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [business, setBusiness] = useState<Business | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const businessData = localStorage.getItem('business')
    if (!businessData) {
      router.push('/login')
      return
    }
    try {
      const parsed = JSON.parse(businessData)
      if (!parsed?.id || !parsed?.name) {
        localStorage.removeItem('business')
        router.push('/login')
        return
      }
      setBusiness(parsed)
    } catch {
      localStorage.removeItem('business')
      router.push('/login')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (business && !isLoading) {
      router.replace('/dashboard/main')
    }
  }, [business, isLoading, router])

  if (isLoading || !business) {
    return (
      <div className="min-h-[240px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-white/10 border-t-indigo-500 animate-spin" aria-hidden />
          <p className="text-sm text-white/70">Перевірка даних...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[240px] flex items-center justify-center">
      <p className="text-sm text-white/70">Перенаправлення на головну...</p>
    </div>
  )
}

