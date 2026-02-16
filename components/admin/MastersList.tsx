'use client'

import { useEffect, useState } from 'react'
import { MasterProfileCard } from './MasterProfileCard'
import { useRouter } from 'next/navigation'

interface Master {
  id: string
  name: string
  photo?: string
  bio?: string
  rating: number
}

interface MastersListProps {
  businessId: string
}

export function MastersList({ businessId }: MastersListProps) {
  const router = useRouter()
  const [masters, setMasters] = useState<Master[]>([])
  const [loading, setLoading] = useState(true)
  const [masterStats, setMasterStats] = useState<Record<string, any>>({})

  useEffect(() => {
    fetch(`/api/masters?businessId=${businessId}`)
      .then((res) => res.json())
      .then((data) => {
        setMasters(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [businessId])

  useEffect(() => {
    if (!masters || masters.length === 0) return
    masters.forEach((master) => {
      fetch(`/api/masters/${master.id}/stats`)
        .then((res) => res.json())
        .then((data) => {
          setMasterStats((prev) => ({ ...prev, [master.id]: data }))
        })
        .catch(() => {
          // Use default stats on error
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

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-lg p-6">
        <p className="text-gray-500 text-center">Завантаження...</p>
      </div>
    )
  }

  if (masters.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-lg p-6 text-center">
        <p className="text-gray-500 mb-4">Немає майстрів</p>
        <button
          onClick={() => router.push('/dashboard/settings')}
          className="px-4 py-2 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all active:scale-95"
        >
          Додати спеціаліста
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
          <MasterProfileCard
            key={master.id}
            master={master}
            stats={stats}
            onScheduleClick={() => router.push(`/dashboard/settings?master=${master.id}`)}
          />
        )
      })}
    </div>
  )
}

