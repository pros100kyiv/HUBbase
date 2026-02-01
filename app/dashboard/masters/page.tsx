'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MasterProfileCard } from '@/components/admin/MasterProfileCard'

interface Master {
  id: string
  name: string
  photo?: string
  bio?: string
  rating: number
  phone?: string
  isActive?: boolean
}

export default function MastersPage() {
  const router = useRouter()
  const [business, setBusiness] = useState<any>(null)
  const [masters, setMasters] = useState<Master[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const businessData = localStorage.getItem('business')
    if (!businessData) {
      router.push('/login')
      return
    }
    try {
      const parsed = JSON.parse(businessData)
      setBusiness(parsed)
    } catch {
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    if (!business) return

    fetch(`/api/masters?businessId=${business.id}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch masters')
        }
        return res.json()
      })
      .then((data) => {
        // Ensure data is an array
        const mastersArray = Array.isArray(data) ? data : []
        setMasters(mastersArray)
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error loading masters:', error)
        setMasters([])
        setLoading(false)
      })
  }, [business])

  const [masterStats, setMasterStats] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!Array.isArray(masters) || masters.length === 0) return

    masters.forEach((master) => {
      fetch(`/api/masters/${master.id}/stats`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch stats')
          return res.json()
        })
        .then((data) => {
          setMasterStats((prev) => ({ ...prev, [master.id]: data }))
        })
        .catch((error) => {
          console.error(`Error loading stats for master ${master.id}:`, error)
          setMasterStats((prev) => ({
            ...prev,
            [master.id]: {
              visits: 0,
              earned: 0,
              reviews: 0,
              clients: 0,
              services: 0,
              branches: 1,
            },
          }))
        })
    })
  }, [masters])

  if (!business || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-gray-500">Завантаження...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between spacing-item">
            <h1 className="text-heading">Майстри</h1>
            <button
              onClick={() => router.push('/dashboard/settings?tab=masters')}
              className="btn-primary"
            >
              + Додати майстра
            </button>
          </div>

          <div className="space-y-1">
            {Array.isArray(masters) && masters.map((master) => {
              const stats = masterStats[master.id] || {
                visits: 0,
                earned: 0,
                reviews: 0,
                clients: 0,
                services: 0,
                branches: 1,
              }

              return (
                <MasterProfileCard
                  key={master.id}
                  master={master}
                  stats={stats}
                  onScheduleClick={() => router.push(`/dashboard/settings?tab=masters&master=${master.id}`)}
                  onToggleActive={async (isActive) => {
                    try {
                      await fetch(`/api/masters/${master.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ isActive }),
                      })
                      // Оновлюємо локальний стан
                      setMasters((prev) =>
                        prev.map((m) => (m.id === master.id ? { ...m, isActive } : m))
                      )
                    } catch (error) {
                      console.error('Failed to update master status:', error)
                    }
                  }}
                />
              )
            })}

            {(!Array.isArray(masters) || masters.length === 0) && (
              <div className="card-candy rounded-candy shadow-soft p-6 text-center">
                <p className="text-gray-500 text-sm mb-3">Немає майстрів</p>
                <button
                  onClick={() => router.push('/dashboard/settings?tab=masters')}
                  className="px-3 py-1.5 text-xs font-bold candy-purple text-white rounded-candy shadow-soft-lg hover:shadow-soft-xl transition-all active:scale-97"
                >
                  Додати першого майстра
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}



