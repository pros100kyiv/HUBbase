'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getBusinessData, clearBusinessData } from '@/lib/business-storage'

export default function DashboardPage() {
  const router = useRouter()

  useEffect(() => {
    const businessData = getBusinessData()
    if (!businessData) {
      router.push('/login')
      return
    }
    try {
      const parsed = JSON.parse(businessData)
      if (!parsed?.id || !parsed?.name) {
        clearBusinessData()
        router.push('/login')
        return
      }
      // Одразу редірект на головну — без проміжного стану та другого рендеру
      router.replace('/dashboard/main')
      return
    } catch {
      clearBusinessData()
      router.push('/login')
    }
  }, [router])

  return (
    <div className="min-h-[240px] flex items-center justify-center outline-none" aria-busy="true">
      <div className="flex flex-col items-center gap-3 outline-none">
        <div className="h-8 w-8 rounded-full border-2 border-white/10 border-t-indigo-500 animate-spin" aria-hidden />
        <p className="text-sm text-white/70">Перевірка даних...</p>
      </div>
    </div>
  )
}

