'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { BellIcon, XIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

interface AppointmentNotification {
  id: string
  clientName: string
  clientPhone: string
  startTime: string
  services?: string
}

interface NotificationToastProps {
  businessId: string
  onConfirm?: (id: string) => void
  onDismiss?: (id: string) => void
}

export function NotificationToast({ businessId, onConfirm, onDismiss }: NotificationToastProps) {
  const [notifications, setNotifications] = useState<AppointmentNotification[]>([])
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!businessId) return

    const fetchNewAppointments = async () => {
      try {
        const response = await fetch(`/api/appointments?businessId=${businessId}&status=Pending`)
        if (response.ok) {
          const data = await response.json()
          const appointments = Array.isArray(data) ? data : []
          
          // Фільтруємо тільки нові записи (які ще не показувалися)
          const newAppointments = appointments.filter(
            (apt: AppointmentNotification) => !seenIds.has(apt.id)
          )

          if (newAppointments.length > 0) {
            // Показуємо тільки останній новий запис
            const latest = newAppointments[newAppointments.length - 1]
            setNotifications([latest])
            setSeenIds(prev => {
              const newSet = new Set(prev)
              newSet.add(latest.id)
              return newSet
            })
          }
        }
      } catch (error) {
        console.error('Error fetching new appointments:', error)
      }
    }

    fetchNewAppointments()
    const interval = setInterval(fetchNewAppointments, 10000) // Перевіряємо кожні 10 секунд
    return () => clearInterval(interval)
  }, [businessId, seenIds])

  const handleDismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    setSeenIds(prev => new Set([...prev, id]))
    onDismiss?.(id)
  }

  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => {
        const startTime = new Date(notification.startTime)
        let servicesList: string[] = []
        try {
          if (notification.services) {
            servicesList = JSON.parse(notification.services)
          }
        } catch (e) {
          // Ignore
        }

        return (
          <div
            key={notification.id}
            className={cn(
              'bg-white dark:bg-gray-800 border-2 border-candy-orange rounded-candy-sm shadow-soft-lg p-4',
              'animate-slide-up'
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full candy-orange flex items-center justify-center flex-shrink-0">
                  <BellIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-foreground dark:text-white">
                    Новий запис!
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {format(startTime, 'd MMMM, HH:mm', { locale: uk })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(notification.id)}
                className="p-1 rounded-candy-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            
            <div className="space-y-1.5 text-xs">
              <p className="font-bold text-foreground dark:text-white">
                {notification.clientName}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                {notification.clientPhone}
              </p>
              {servicesList.length > 0 && (
                <p className="text-gray-500 dark:text-gray-500">
                  {servicesList.join(', ')}
                </p>
              )}
            </div>

            {onConfirm && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    onConfirm(notification.id)
                    handleDismiss(notification.id)
                  }}
                  className="flex-1 px-3 py-1.5 rounded-candy-xs candy-mint text-white text-xs font-bold shadow-soft hover:shadow-soft-lg transition-all"
                >
                  Підтвердити
                </button>
                <button
                  onClick={() => handleDismiss(notification.id)}
                  className="px-3 py-1.5 rounded-candy-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                  Пізніше
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

