'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useNavigationProgress } from '@/contexts/NavigationProgressContext'
import { HomeIcon, CalendarIcon, UsersIcon, UserIcon, ChartIcon, SettingsIcon, ShareIcon, MoneyIcon, ClockIcon } from '@/components/icons'
import { XbaseLogo } from '@/components/layout/XbaseLogo'
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
  const { startNavigation } = useNavigationProgress()
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

  // Main Navigation
  const mainNavItems: NavItem[] = [
    { id: 'main', label: 'Головна', icon: <HomeIcon />, path: '/dashboard/main' },
    { id: 'appointments', label: 'Записи', icon: <CalendarIcon />, path: '/dashboard/appointments' },
    { id: 'price', label: 'Прайс', icon: <MoneyIcon />, path: '/dashboard/price' },
    { id: 'clients', label: 'Клієнти', icon: <UsersIcon />, path: '/dashboard/clients' },
    { id: 'masters', label: 'Спеціалісти', icon: <UserIcon />, path: '/dashboard/masters' },
    { id: 'schedule', label: 'Графік роботи', icon: <ClockIcon />, path: '/dashboard/schedule' },
    { id: 'social', label: 'Соцмережі', icon: <ShareIcon />, path: '/dashboard/social' },
    { id: 'analytics', label: 'Аналітика', icon: <ChartIcon />, path: '/dashboard/analytics' },
  ]

  const handleNotificationUpdate = () => {
    if (business?.id) {
      fetch(`/api/appointments?businessId=${business.id}&status=Pending`)
        .then((res) => res.json())
        .then((data) => setPendingCount(Array.isArray(data) ? data.length : 0))
        .catch((error) => console.error('Error fetching pending count:', error))
    }
  }

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.path || (item.path === '/dashboard/main' && pathname === '/dashboard/main')
    return (
      <button
        key={item.id}
        onClick={() => {
          if (item.onClick) {
            item.onClick()
          } else {
            startNavigation()
            router.push(item.path)
          }
        }}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-200 relative group',
          isActive
            ? 'nav-item-active'
            : 'text-gray-300 hover:bg-white/10 hover:text-white'
        )}
        title={item.label}
      >
        <div className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-white' : 'text-gray-400 group-hover:text-white')}>
          {item.icon}
        </div>
        <span className={cn("text-sm font-medium flex-1", isActive ? 'text-white' : 'text-gray-300')}>
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
  }

  return (
    <>
      <aside className={cn('border-r w-0 md:w-64 min-h-screen fixed left-0 top-0 z-40 hidden md:block sidebar-theme backdrop-blur-xl', className)}>
        {/* Logo Section */}
        <div className="p-6 border-b">
          <XbaseLogo size="sm" />
        </div>
        
        <nav className="p-4 space-y-6">
          {/* Main Navigation */}
          <div className="space-y-1">
            {mainNavItems.map(renderNavItem)}
          </div>

          {/* Settings */}
          <div className="space-y-1 pt-4 border-t">
            <button
              onClick={() => { startNavigation(); router.push('/dashboard/settings') }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-200',
                pathname === '/dashboard/settings'
                  ? 'nav-item-active'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              )}
            >
              <div className={cn('w-5 h-5 flex-shrink-0', pathname === '/dashboard/settings' ? 'text-white' : 'text-gray-400')}>
                <SettingsIcon />
              </div>
              <span className={cn("text-sm font-medium", pathname === '/dashboard/settings' ? 'text-white' : 'text-gray-300')}>
                Налаштування
              </span>
            </button>
          </div>
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

