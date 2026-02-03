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
      <aside className={cn('bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 w-0 md:w-64 min-h-screen fixed left-0 top-0 z-40 shadow-sm hidden md:block', className)}>
        {/* Logo Section */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gradient-indigo flex items-center justify-center text-white font-bold text-lg shadow-md">
              X
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">Xbase</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Booking System</p>
            </div>
          </div>
        </div>
        
        <nav className="p-4 space-y-1">
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
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 relative group',
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                )}
                title={item.label}
              >
                <div className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-white' : 'text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400')}>
                  {item.icon}
                </div>
                <span className={cn("text-sm font-medium flex-1", isActive ? 'text-white' : 'text-slate-900 dark:text-slate-100')}>
                  {item.label}
                </span>
                {item.badge && item.badge > 0 && (
                  <span className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-full min-w-[20px] text-center",
                    isActive 
                      ? "bg-white/20 text-white" 
                      : "bg-red-500 text-white"
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

