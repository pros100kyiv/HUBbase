'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useNavigationProgress } from '@/contexts/NavigationProgressContext'
import { HomeIcon, CalendarIcon, UsersIcon, UserIcon, ChartIcon, SettingsIcon, BellIcon, XIcon, ShareIcon, MoneyIcon, ClockIcon } from '@/components/icons'
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

interface MobileSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { startNavigation } = useNavigationProgress()
  const [business, setBusiness] = useState<any>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const prevPathnameRef = useRef<string | null>(null)

  // Close sidebar when pathname changes (only if it actually changed)
  useEffect(() => {
    if (isOpen && pathname && prevPathnameRef.current !== null && prevPathnameRef.current !== pathname) {
      onClose()
    }
    prevPathnameRef.current = pathname
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isOpen])

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
      const interval = setInterval(fetchPendingCount, 120_000) // 2 хв — економія compute (Neon sleep)
      return () => clearInterval(interval)
    }
  }, [business])

  // Індикатор біля «Записи» зникає, коли користувач вже на сторінці записів
  const showAppointmentsBadge = pendingCount > 0 && pathname !== '/dashboard/appointments'

  const navItems: NavItem[] = [
    { id: 'main', label: 'Головна', icon: <HomeIcon />, path: '/dashboard/main' },
    { id: 'appointments', label: 'Записи', icon: <CalendarIcon />, path: '/dashboard/appointments', badge: showAppointmentsBadge ? pendingCount : undefined },
    { id: 'price', label: 'Прайс', icon: <MoneyIcon />, path: '/dashboard/price' },
    { id: 'clients', label: 'Клієнти', icon: <UsersIcon />, path: '/dashboard/clients' },
    { id: 'schedule', label: 'Графік роботи', icon: <ClockIcon />, path: '/dashboard/schedule' },
    { id: 'social', label: 'Соцмережі', icon: <ShareIcon />, path: '/dashboard/social' },
    { id: 'analytics', label: 'Аналітика', icon: <ChartIcon />, path: '/dashboard/analytics' },
    { id: 'notifications', label: 'Сповіщення', icon: <BellIcon />, path: '#', badge: pendingCount > 0 ? pendingCount : undefined, onClick: () => setShowNotifications(true) },
    { id: 'settings', label: 'Налаштування', icon: <SettingsIcon />, path: '/dashboard/settings' },
  ]

  const handleNavClick = (item: NavItem) => {
    if (item.onClick) {
      item.onClick()
    } else {
      startNavigation()
      router.push(item.path)
    }
    onClose()
  }

  // Закрити по Escape
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  return (
    <>
      {/* Mobile Sidebar Overlay — клік закриває */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          style={{ padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' }}
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Mobile Sidebar — safe-area, не вилітає за екран */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-[min(288px,calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right)))] max-w-[85vw] border-r z-50 transform transition-transform duration-300 ease-in-out md:hidden sidebar-theme backdrop-blur-xl flex flex-col pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pb-[env(safe-area-inset-bottom)] box-border',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header — лого клікабельний на головну, кнопка закрити */}
        <div className="flex items-center justify-between flex-shrink-0 py-4 px-4 border-b border-white/10">
          <button
            type="button"
            onClick={() => handleNavClick({ id: 'main', label: 'Головна', icon: null, path: '/dashboard/main' })}
            className="flex items-center gap-2 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors -ml-1 p-2"
            aria-label="На головну"
          >
            <XbaseLogo size="sm" />
          </button>
          <button
            onClick={onClose}
            className="touch-target p-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors text-gray-400 hover:text-white"
            aria-label="Закрити меню"
            title="Закрити (Escape)"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation — touch-friendly */}
        <nav className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0 pb-[env(safe-area-inset-bottom,0)]">
          <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Меню
          </p>
          <div className="space-y-0.5">
            {navItems.filter((i) => i.id !== 'settings').map((item) => {
              const isActive = pathname === item.path || (item.path === '/dashboard/main' && pathname === '/dashboard/main')
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  className={cn(
                    'nav-item-base w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-left transition-all duration-200 relative group touch-target',
                    isActive
                      ? 'nav-item-active'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white active:bg-white/15'
                  )}
                >
                  <div className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-white' : 'text-gray-400 group-hover:text-white')}>
                    {item.icon}
                  </div>
                  <span className={cn('text-sm font-medium flex-1', isActive ? 'text-white' : 'text-gray-300')}>
                    {item.label}
                  </span>
                  {item.badge != null && item.badge > 0 && (
                    <span className={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded-full min-w-[20px] text-center',
                      isActive ? 'bg-white/20 text-white' : 'bg-red-500 text-white'
                    )}>
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-white/10">
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Система
            </p>
            <button
              onClick={() => handleNavClick({ id: 'settings', label: 'Налаштування', icon: <SettingsIcon />, path: '/dashboard/settings' })}
              className={cn(
                'nav-item-base w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-left transition-all duration-200 touch-target',
                pathname === '/dashboard/settings'
                  ? 'nav-item-active'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white active:bg-white/15'
              )}
            >
              <div className={cn('w-5 h-5 flex-shrink-0', pathname === '/dashboard/settings' ? 'text-white' : 'text-gray-400')}>
                <SettingsIcon />
              </div>
              <span className={cn('text-sm font-medium', pathname === '/dashboard/settings' ? 'text-white' : 'text-gray-300')}>
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
          onUpdate={() => {
            if (business?.id) {
              fetch(`/api/appointments?businessId=${business.id}&status=Pending`)
                .then((res) => res.json())
                .then((data) => setPendingCount(Array.isArray(data) ? data.length : 0))
                .catch((error) => console.error('Error fetching pending count:', error))
            }
          }}
        />
      )}
    </>
  )
}

