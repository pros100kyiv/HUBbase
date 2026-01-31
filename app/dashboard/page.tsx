'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DailyJournal } from '@/components/admin/DailyJournal'
import { Statistics } from '@/components/admin/Statistics'
import { MastersList } from '@/components/admin/MastersList'

interface Business {
  id: string
  name: string
  slug: string
  email: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [business, setBusiness] = useState<Business | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Перевіряємо чи є дані в localStorage
    const businessData = localStorage.getItem('business')
    
    if (!businessData) {
      router.push('/login')
      return
    }

    try {
      const parsed = JSON.parse(businessData)
      
      // Перевіряємо чи є обов'язкові поля
      if (!parsed || !parsed.id || !parsed.name) {
        console.error('Invalid business data:', parsed)
        localStorage.removeItem('business')
        router.push('/login')
        return
      }
      
      setBusiness(parsed)
      setIsLoading(false)
    } catch (error) {
      console.error('Error parsing business data:', error)
      localStorage.removeItem('business')
      router.push('/login')
    }
  }, [router])

  // Redirect to main page when business is loaded
  useEffect(() => {
    if (business && !isLoading) {
      router.replace('/dashboard/main')
    }
  }, [business, isLoading, router])

  const handleLogout = () => {
    localStorage.removeItem('business')
    router.push('/login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Завантаження...</p>
          <p className="text-gray-400 text-sm">Перевірка даних...</p>
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Бізнес не знайдено</p>
          <Button onClick={() => router.push('/login')}>Увійти</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-gray-500">Перенаправлення...</p>
    </div>
  )
}

