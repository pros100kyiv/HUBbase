'use client'

import { useEffect, useState } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/admin/Sidebar'
import { NotificationToast } from '@/components/ui/notification-toast'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [businessId, setBusinessId] = useState<string | null>(null)

  useEffect(() => {
    const loadBusiness = () => {
      const businessData = localStorage.getItem('business')
      if (businessData) {
        try {
          const parsed = JSON.parse(businessData)
          setBusinessId(parsed.id)
        } catch {}
      }
    }
    loadBusiness()
    const interval = setInterval(loadBusiness, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Sidebar />
      <div className="pt-2">
        {children}
      </div>
      {businessId && (
        <NotificationToast
          businessId={businessId}
          onConfirm={async (id) => {
            try {
              await fetch(`/api/appointments/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Confirmed' }),
              })
            } catch (error) {
              console.error('Error confirming appointment:', error)
            }
          }}
        />
      )}
    </div>
  )
}



