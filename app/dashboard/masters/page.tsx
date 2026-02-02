'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MasterProfileCard } from '@/components/admin/MasterProfileCard'
import { UserIcon } from '@/components/icons'

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
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-2">
              Спеціалісти
            </h1>
            <p className="text-base text-gray-600 dark:text-gray-400">
              Управління командою спеціалістів
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard/settings?tab=masters')}
            className="px-6 py-3 bg-gradient-to-r from-candy-purple to-candy-blue text-white font-bold rounded-candy-sm shadow-soft-xl hover:shadow-soft-2xl transition-all active:scale-95 whitespace-nowrap"
          >
            + Додати спеціаліста
          </button>
        </div>
      </div>

      {/* Masters List */}
      {(!Array.isArray(masters) || masters.length === 0) ? (
        <div className="card-candy p-12 text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-32 h-32 bg-gradient-to-br from-candy-purple/20 to-candy-blue/20 rounded-full flex items-center justify-center">
              <UserIcon className="w-16 h-16 text-candy-purple" />
            </div>
          </div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">
            Немає спеціалістів
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Додайте першого спеціаліста, щоб почати працювати
          </p>
          <button
            onClick={() => router.push('/dashboard/settings?tab=masters')}
            className="px-6 py-3 bg-gradient-to-r from-candy-purple to-candy-blue text-white font-bold rounded-candy-sm shadow-soft-xl hover:shadow-soft-2xl transition-all active:scale-95"
          >
            Додати першого спеціаліста
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {masters.map((master) => {
            const stats = masterStats[master.id] || {
              visits: 0,
              earned: 0,
              reviews: 0,
              clients: 0,
              services: 0,
              branches: 1,
            }

            return (
              <div key={master.id} className="card-candy p-6 hover:shadow-soft-2xl transition-all">
                <MasterProfileCard
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
                      setMasters((prev) =>
                        prev.map((m) => (m.id === master.id ? { ...m, isActive } : m))
                      )
                    } catch (error) {
                      console.error('Failed to update master status:', error)
                    }
                  }}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
