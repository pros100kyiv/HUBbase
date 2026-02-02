'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { HomeIcon, CalendarIcon, UsersIcon, UserIcon, ChartIcon, SettingsIcon, BellIcon, ShareIcon } from '@/components/icons'
import { NotificationsPanel } from './NotificationsPanel'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  path: string
  badge?: number
  onClick?: () => void
}

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [business, setBusiness] = useState<any>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    const businessData = localStorage.getItem('business')
    if (businessData) {
      try {
        const parsed = JSON.parse(businessData)
        setBusiness(parsed)
      } catch (e) {
        // Ignore
      }
    }
  }, [])

  useEffect(() => {
    if (business?.id) {
      const fetchPendingCount = async () => {
        try {
          const response = await fetch(`/api/appointments?businessId=${business.id}&status=Pending`)
          if (response.ok) {
            const data = await response.json()
            setPendingCount(Array.isArray(data) ? data.length : 0)
          }
        } catch (error) {
          console.error('Error fetching pending count:', error)
        }
      }
      fetchPendingCount()
      const interval = setInterval(fetchPendingCount, 30000) // Оновлюємо кожні 30 секунд
      return () => clearInterval(interval)
    }
  }, [business])

  const navItems: NavItem[] = [
    { id: 'main', label: 'Головна', icon: <HomeIcon />, path: '/dashboard' },
    { id: 'appointments', label: 'Записи', icon: <CalendarIcon />, path: '/dashboard/appointments' },
    { id: 'clients', label: 'Клієнти', icon: <UsersIcon />, path: '/dashboard/clients' },
    { id: 'masters', label: 'Спеціалісти', icon: <UserIcon />, path: '/dashboard/masters' },
    { id: 'analytics', label: 'Аналітика', icon: <ChartIcon />, path: '/dashboard/analytics' },
    { id: 'social', label: 'Соцмережі', icon: <ShareIcon />, path: '/dashboard/social' },
    { id: 'notifications', label: 'Сповіщення', icon: <BellIcon />, path: '#', badge: pendingCount, onClick: () => setShowNotifications(true) },
    { id: 'settings', label: 'Налаштування', icon: <SettingsIcon />, path: '/dashboard/settings' },
  ]

  const handleNotificationUpdate = () => {
    if (business?.id) {
      fetch(`/api/appointments?businessId=${business.id}&status=Pending`)
        .then((res) => res.json())
        .then((data) => setPendingCount(Array.isArray(data) ? data.length : 0))
        .catch((error) => console.error('Error fetching pending count:', error))
    }
  }

  return (
    <>
      <aside className={cn('bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border-r border-gray-200 dark:border-gray-700/50 w-0 md:w-56 min-h-screen fixed left-0 top-12 z-40 shadow-soft-xl hidden md:block', className)}>
        <nav className="p-1.5 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.path || (item.path === '/dashboard' && pathname === '/dashboard')
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.onClick) {
                    item.onClick()
                  } else {
                    router.push(item.path)
                  }
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-candy-xs text-left transition-all duration-200 active:scale-[0.98] relative',
                  isActive
                    ? 'bg-gradient-to-r from-candy-blue to-candy-purple text-white shadow-soft-lg'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                )}
                title={item.label}
              >
                <div className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-white' : 'text-gray-700 dark:text-gray-300')}>
                  {item.icon}
                </div>
                <span className={cn("text-xs font-bold flex-1", isActive ? 'text-white' : 'text-gray-900 dark:text-white')}>
                  {item.label}
                </span>
                {item.badge && item.badge > 0 && (
                  <span className={cn(
                    "text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                    isActive 
                      ? "bg-white text-candy-purple" 
                      : "bg-gradient-to-r from-candy-pink to-red-500 text-white"
                  )}>
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </aside>
      {business?.id && (
        <NotificationsPanel
          businessId={business.id}
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
          onUpdate={handleNotificationUpdate}
        />
      )}
    </>
  )
}

