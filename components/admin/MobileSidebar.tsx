'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { HomeIcon, CalendarIcon, UsersIcon, UserIcon, ChartIcon, SettingsIcon, BellIcon, XIcon } from '@/components/icons'
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
      const interval = setInterval(fetchPendingCount, 30000)
      return () => clearInterval(interval)
    }
  }, [business])

  const navItems: NavItem[] = [
    { id: 'main', label: 'Головна', icon: <HomeIcon />, path: '/dashboard' },
    { id: 'appointments', label: 'Записи', icon: <CalendarIcon />, path: '/dashboard/appointments' },
    { id: 'clients', label: 'Клієнти', icon: <UsersIcon />, path: '/dashboard/clients' },
    { id: 'masters', label: 'Спеціалісти', icon: <UserIcon />, path: '/dashboard/masters' },
    { id: 'analytics', label: 'Аналітика', icon: <ChartIcon />, path: '/dashboard/analytics' },
    { id: 'notifications', label: 'Сповіщення', icon: <BellIcon />, path: '#', badge: pendingCount, onClick: () => setShowNotifications(true) },
    { id: 'settings', label: 'Налаштування', icon: <SettingsIcon />, path: '/dashboard/settings' },
  ]

  const handleNavClick = (item: NavItem) => {
    if (item.onClick) {
      item.onClick()
    } else {
      router.push(item.path)
    }
    onClose()
  }

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 transform transition-transform duration-300 ease-in-out md:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-candy-sm bg-gradient-to-r from-candy-blue to-candy-purple flex items-center justify-center text-white font-black text-sm shadow-soft-xl">
              X
            </div>
            <span className="text-base font-black text-gray-900 dark:text-white">Xbase</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-candy-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <XIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-2 space-y-1 overflow-y-auto h-[calc(100vh-80px)]">
          {navItems.map((item) => {
            const isActive = pathname === item.path || (item.path === '/dashboard' && pathname === '/dashboard')
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-candy-sm text-left transition-all duration-200 active:scale-[0.98] relative',
                  isActive
                    ? 'bg-gradient-to-r from-candy-blue to-candy-purple text-white shadow-soft-xl'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                <div className={cn('w-6 h-6 flex-shrink-0', isActive ? 'text-white' : 'text-gray-700 dark:text-gray-300')}>
                  {item.icon}
                </div>
                <span className={cn('text-base font-bold flex-1', isActive ? 'text-white' : 'text-gray-900 dark:text-white')}>
                  {item.label}
                </span>
                {item.badge && item.badge > 0 && (
                  <span className={cn(
                    'text-xs font-black px-2 py-0.5 rounded-full min-w-[24px] text-center',
                    isActive
                      ? 'bg-white text-candy-purple'
                      : 'bg-gradient-to-r from-candy-pink to-red-500 text-white'
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

