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

  // Main Navigation
  const mainNavItems: NavItem[] = [
    { id: 'main', label: 'Dashboard', icon: <HomeIcon />, path: '/dashboard' },
    { id: 'appointments', label: 'Calendar', icon: <CalendarIcon />, path: '/dashboard/appointments' },
    { id: 'clients', label: 'My task', icon: <UsersIcon />, path: '/dashboard/clients' },
    { id: 'analytics', label: "Static's", icon: <ChartIcon />, path: '/dashboard/analytics' },
    { id: 'masters', label: 'Document', icon: <UserIcon />, path: '/dashboard/masters' },
  ]

  // Integration Section
  const integrationItems: NavItem[] = [
    { id: 'social', label: 'Slack', icon: <ShareIcon />, path: '/dashboard/social' },
    { id: 'telegram', label: 'Discord', icon: <ShareIcon />, path: '/dashboard/social' },
    { id: 'add-plugin', label: 'Add Plugin', icon: <ShareIcon />, path: '/dashboard/social' },
  ]

  // Teams Section
  const teamsItems: NavItem[] = [
    { id: 'team-seo', label: 'Seo', icon: <UsersIcon />, path: '/dashboard/clients' },
    { id: 'team-marketing', label: 'Marketing', icon: <UsersIcon />, path: '/dashboard/clients' },
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
          'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-200 relative group',
          isActive
            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
            : 'text-white hover:bg-gray-800'
        )}
        style={isActive ? { boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' } : {}}
        title={item.label}
      >
        <div className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-white' : 'text-gray-400 group-hover:text-white')}>
          {item.icon}
        </div>
        <span className={cn("text-sm font-medium flex-1", isActive ? 'text-white' : 'text-white')}>
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
      <aside className={cn('bg-[#1A1A1A] border-r border-gray-800 w-0 md:w-64 min-h-screen fixed left-0 top-0 z-40 hidden md:block', className)}>
        {/* Logo Section */}
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>Growth</h1>
        </div>
        
        <nav className="p-4 space-y-6">
          {/* Main Navigation */}
          <div className="space-y-1">
            {mainNavItems.map(renderNavItem)}
          </div>

          {/* INTEGRATION Section */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 mb-2" style={{ letterSpacing: '0.1em' }}>INTEGRATION</p>
            {integrationItems.map(renderNavItem)}
          </div>

          {/* TEAMS Section */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 mb-2" style={{ letterSpacing: '0.1em' }}>TEAMS</p>
            {teamsItems.map(renderNavItem)}
          </div>

          {/* Settings */}
          <div className="space-y-1 pt-4 border-t border-gray-800">
            <button
              onClick={() => router.push('/dashboard/settings')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-200',
                pathname === '/dashboard/settings'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-sm'
                  : 'text-white hover:bg-gray-800'
              )}
            >
              <div className={cn('w-5 h-5 flex-shrink-0', pathname === '/dashboard/settings' ? 'text-white' : 'text-gray-400')}>
                <SettingsIcon />
              </div>
              <span className={cn("text-sm font-medium", pathname === '/dashboard/settings' ? 'text-white' : 'text-white')}>
                Setting
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

