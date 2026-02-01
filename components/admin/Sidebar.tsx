'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { HomeIcon, CalendarIcon, UsersIcon, UserIcon, StarIcon, ChartIcon, SettingsIcon, BellIcon, XIcon } from '@/components/icons'
import { NotificationsPanel } from './NotificationsPanel'
import { useSidebar } from '@/contexts/SidebarContext'

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
  const { isOpen, close } = useSidebar()
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
    { id: 'main', label: 'Головна', icon: <HomeIcon />, path: '/dashboard/main' },
    { id: 'appointments', label: 'Записи', icon: <CalendarIcon />, path: '/dashboard/appointments' },
    { id: 'clients', label: 'Клієнти', icon: <UsersIcon />, path: '/dashboard/clients' },
    { id: 'masters', label: 'Майстри', icon: <UserIcon />, path: '/dashboard/masters' },
    { id: 'pricelist', label: 'Прайс-лист', icon: <StarIcon />, path: '/dashboard/pricelist' },
    { id: 'analytics', label: 'CRM', icon: <ChartIcon />, path: '/dashboard/analytics' },
    { id: 'notifications', label: 'Бронювання', icon: <BellIcon />, path: '#', badge: pendingCount, onClick: () => setShowNotifications(true) },
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
      {/* Overlay для закриття sidebar на всіх пристроях */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30"
          onClick={close}
        />
      )}
      
      <aside className={cn(
        'bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 w-16 md:w-40 h-screen fixed left-0 top-0 pt-14 md:pt-16 z-40 shadow-soft transition-transform duration-300 ease-in-out overflow-y-auto',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        className
      )}>
        {/* Кнопка закриття */}
        {isOpen && (
          <button
            onClick={close}
            className="absolute top-2 right-2 p-1 rounded-candy-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}
        
        <nav className="p-1.5 md:p-2 space-y-0.5 md:space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path || (item.path === '/dashboard/main' && (pathname === '/dashboard' || pathname === '/dashboard/main'))
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
                  'w-full flex flex-col items-center gap-1 md:gap-1.5 px-1 md:px-2 py-1.5 md:py-2 rounded-candy-sm text-center transition-all duration-200 active:scale-[0.97] group relative',
                  isActive
                    ? 'candy-purple text-white shadow-soft-lg'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-foreground'
                )}
                title={item.label}
              >
                <div className={cn(isActive ? 'text-white' : 'text-gray-600 dark:text-gray-400', 'w-5 h-5 md:w-6 md:h-6')}>
                  {item.icon}
                </div>
                <span className={cn("text-[10px] md:text-xs font-bold leading-tight hidden md:block", isActive ? 'text-white' : 'text-gray-600 dark:text-gray-400')}>
                  {item.label}
                </span>
                {item.badge && item.badge > 0 && (
                  <span className={cn(
                    "absolute top-1 right-1 text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                    isActive 
                      ? "bg-white text-candy-purple" 
                      : "candy-pink text-white"
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

