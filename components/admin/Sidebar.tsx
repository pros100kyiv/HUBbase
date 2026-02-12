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
    if (!business?.id) return
    let cancelled = false
    const fetchPendingCount = async () => {
      try {
        const response = await fetch(`/api/appointments?businessId=${business.id}&status=Pending`)
        if (cancelled) return
        if (response.ok) {
          const data = await response.json()
          const count = Array.isArray(data) ? data.length : 0
          if (!cancelled) setPendingCount(count)
        }
      } catch {
        if (!cancelled) setPendingCount(0)
      }
    }
    fetchPendingCount()
    const interval = setInterval(fetchPendingCount, 120_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [business?.id])

  // Індикатор біля «Записи» зникає, коли користувач вже на сторінці записів
  const showAppointmentsBadge = pendingCount > 0 && pathname !== '/dashboard/appointments'

  // Main Navigation
  const mainNavItems: NavItem[] = [
    { id: 'main', label: 'Головна', icon: <HomeIcon />, path: '/dashboard/main' },
    { id: 'appointments', label: 'Записи', icon: <CalendarIcon />, path: '/dashboard/appointments', badge: showAppointmentsBadge ? pendingCount : undefined },
    { id: 'price', label: 'Послуги та ціни', icon: <MoneyIcon />, path: '/dashboard/price' },
    { id: 'clients', label: 'Клієнти', icon: <UsersIcon />, path: '/dashboard/clients' },
    { id: 'schedule', label: 'Графік роботи', icon: <ClockIcon />, path: '/dashboard/schedule' },
    { id: 'social', label: 'Соцмережі', icon: <ShareIcon />, path: '/dashboard/social' },
    { id: 'analytics', label: 'Аналітика', icon: <ChartIcon />, path: '/dashboard/analytics' },
  ]

  const handleNotificationUpdate = () => {
    if (!business?.id) return
    fetch(`/api/appointments?businessId=${business.id}&status=Pending`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPendingCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setPendingCount(0))
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
          'nav-item-base w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all duration-200 relative group',
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
      <aside className={cn('border-r w-0 md:w-64 min-h-screen fixed left-0 top-0 z-40 hidden md:flex flex-col sidebar-theme backdrop-blur-xl', className)}>
        {/* Logo — клік веде на головну кабінету */}
        <div className="flex-shrink-0 border-b px-4 py-5">
          <button
            type="button"
            onClick={() => { startNavigation(); router.push('/dashboard/main') }}
            className="flex items-center gap-2 w-full rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors -m-2 p-2 text-left"
            title="На головну"
            aria-label="На головну"
          >
            <XbaseLogo size="sm" variant="light" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 md:p-4 min-h-0">
          <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Меню
          </p>
          <div className="space-y-0.5">
            {mainNavItems.map(renderNavItem)}
          </div>

          <div className="mt-5 pt-4 border-t border-white/10">
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Система
            </p>
            <button
              onClick={() => { startNavigation(); router.push('/dashboard/settings') }}
              className={cn(
                'nav-item-base w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all duration-200',
                pathname === '/dashboard/settings'
                  ? 'nav-item-active'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              )}
              title="Налаштування"
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

