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

