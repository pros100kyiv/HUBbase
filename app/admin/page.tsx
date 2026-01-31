'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfDay, addMinutes, isSameDay } from 'date-fns'
import { uk } from 'date-fns/locale'
import { DailyJournal } from '@/components/admin/DailyJournal'

export default function AdminPage() {
  const router = useRouter()
  const [businessId, setBusinessId] = useState<string | null>(null)

  useEffect(() => {
    const businessData = localStorage.getItem('business')
    if (!businessData) {
      router.push('/login')
      return
    }
    try {
      const parsed = JSON.parse(businessData)
      if (parsed?.id) {
        setBusinessId(parsed.id)
      } else {
        router.push('/login')
      }
    } catch {
      router.push('/login')
    }
  }, [router])

  if (!businessId) {
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-body">Завантаження...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-title text-primary mb-8">
          АДМІН ПАНЕЛЬ
        </h1>
        <DailyJournal businessId={businessId} />
      </div>
    </div>
  )
}





