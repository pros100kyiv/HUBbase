'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()

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
      // Одразу редірект на головну — без проміжного стану та другого рендеру
      router.replace('/dashboard/main')
      return
    } catch {
      localStorage.removeItem('business')
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

