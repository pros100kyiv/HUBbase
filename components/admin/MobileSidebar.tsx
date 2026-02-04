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
    { id: 'main', label: 'Головна', icon: <HomeIcon />, path: '/dashboard/main' },
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

  const sidebarStyle = {
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    backdropFilter: 'blur(25px)',
    WebkitBackdropFilter: 'blur(25px)' as const,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  }

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Mobile Sidebar — у стилі Dashboard (темний glass) */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-72 border-r z-50 transform transition-transform duration-300 ease-in-out md:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={sidebarStyle}
      >
        {/* Header — як у десктопному Sidebar */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
          <h1 className="text-xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>Growth</h1>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
            aria-label="Закрити меню"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation — ті самі стилі, що в Sidebar */}
        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-88px)]">
          {navItems.map((item) => {
            const isActive = pathname === item.path || (item.path === '/dashboard/main' && pathname === '/dashboard/main')
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-200 relative group',
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                )}
                style={isActive ? { boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' } : {}}
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

