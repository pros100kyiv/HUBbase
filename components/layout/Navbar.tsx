'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useEffect, useState, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useSidebar } from '@/contexts/SidebarContext'
import { SunIcon, MoonIcon, BellIcon } from '@/components/icons'
import { NotificationsPanel } from '@/components/admin/NotificationsPanel'
import { XbaseLogo } from '@/components/ui/XbaseLogo'

// Оновлюємо бізнес при зміні localStorage
if (typeof window !== 'undefined') {
  window.addEventListener('storage', () => {
    window.location.reload()
  })
}

export function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { toggle: toggleSidebar } = useSidebar()
  const [business, setBusiness] = useState<any>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  let theme: 'light' | 'dark' = 'light'
  let toggleTheme: () => void = () => {}
  let mounted = false
  
  try {
    const themeContext = useTheme()
    theme = themeContext.theme
    toggleTheme = themeContext.toggleTheme
    mounted = themeContext.mounted
  } catch (e) {
    // ThemeProvider not available, use default
  }

  useEffect(() => {
    const loadBusiness = () => {
      const businessData = localStorage.getItem('business')
      if (businessData) {
        try {
          const parsed = JSON.parse(businessData)
          setBusiness(parsed)
        } catch {}
      }
    }
    
    loadBusiness()
    
    // Оновлюємо при зміні pathname (наприклад після логіну)
    const interval = setInterval(loadBusiness, 1000)
    return () => clearInterval(interval)
  }, [pathname])

  // Завантажуємо кількість очікуваних записів
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

  const handleNotificationUpdate = useCallback(() => {
    if (business?.id) {
      fetch(`/api/appointments?businessId=${business.id}&status=Pending`)
        .then((res) => res.json())
        .then((data) => setPendingCount(Array.isArray(data) ? data.length : 0))
        .catch((error) => console.error('Error fetching pending count:', error))
    }
  }, [business])

  const handleLogout = () => {
    localStorage.removeItem('business')
    setBusiness(null)
    router.push('/login')
  }

  // Не показувати навігацію на головній, реєстрації та логіні
  if (pathname === '/' || pathname === '/register' || pathname === '/login') {
    return null
  }

  // Don't show on dashboard pages (they have sidebar)
  if (pathname?.startsWith('/dashboard')) {
    return (
      <>
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-800/50 shadow-soft">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center h-14 md:h-16">
            {/* Left side - Xbase Logo (клікабельний для відкриття sidebar) */}
            <button
              onClick={toggleSidebar}
              className="flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
              title="Перемкнути меню"
            >
              <XbaseLogo size="md" showText={true} />
            </button>

            {/* Center - Business name */}
            <div className="flex items-center justify-center flex-1 min-w-0">
              <div className="text-center">
                <h1 className="text-sm md:text-base font-black text-foreground dark:text-white truncate">
                  {business?.name || 'Dashboard'}
                </h1>
                {business?.phone && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate hidden md:block">
                    {business.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {business && (
                <button
                  onClick={() => setShowNotifications(true)}
                  className="relative p-1.5 md:p-2 rounded-candy-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 active:scale-95"
                  title="Сповіщення"
                >
                  <BellIcon className="w-4 h-4 md:w-5 md:h-5" />
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full candy-pink text-white text-[10px] font-black flex items-center justify-center shadow-soft-lg">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </button>
              )}
              {mounted && (
                <button
                  onClick={toggleTheme}
                  className="p-1.5 md:p-2 rounded-candy-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 active:scale-95"
                  title={theme === 'light' ? 'Увімкнути темну тему' : 'Увімкнути світлу тему'}
                >
                  {theme === 'light' ? (
                    <MoonIcon className="w-4 h-4 md:w-5 md:h-5" />
                  ) : (
                    <SunIcon className="w-4 h-4 md:w-5 md:h-5" />
                  )}
                </button>
              )}
              {business && (
                <>
                  <button
                    onClick={() => window.open(`/qr/${business.slug}`, '_blank')}
                    className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-candy-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all duration-200 text-xs font-bold shadow-soft hover:shadow-soft-lg border-0"
                    title="Відкрити QR код"
                  >
                    <span>QR код</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-candy-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 active:scale-95 transition-all duration-200 text-xs font-bold shadow-soft hover:shadow-soft-lg border-0"
                    title="Вийти з акаунту"
                  >
                    <span>Вийти</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
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

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-800/50 shadow-soft">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center h-14 md:h-16">
            {/* Left side - Xbase Logo */}
            <button
              onClick={toggleSidebar}
              className="flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
              title="Перемкнути меню"
            >
              <XbaseLogo size="md" showText={true} />
            </button>

          {/* Center - Business name and navigation */}
          <div className="flex items-center justify-center flex-1 min-w-0">
            <div className="text-center">
              <h1 className="text-sm md:text-base font-black text-foreground dark:text-white truncate">
                {business?.name || 'Dashboard'}
              </h1>
              {business?.phone && (
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate hidden md:block">
                  {business.phone}
                </p>
              )}
            </div>
            {business && (
              <div className="hidden md:flex gap-1.5 ml-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className={`px-2.5 py-1 rounded-candy-xs text-xs font-bold transition-all duration-200 ${
                    pathname === '/dashboard' 
                      ? 'candy-purple text-white shadow-soft-lg' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  Панель
                </button>
                <button
                  onClick={() => router.push('/dashboard/settings')}
                  className={`px-2.5 py-1 rounded-candy-xs text-xs font-bold transition-all duration-200 ${
                    pathname === '/dashboard/settings' 
                      ? 'candy-purple text-white shadow-soft-lg' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  Налаштування
                </button>
                <button
                  onClick={() => window.open(`/booking/${business.slug}`, '_blank')}
                  className="px-2.5 py-1 rounded-candy-xs text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                >
                  Бронювання
                </button>
              </div>
            )}
          </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {business && (
                <button
                  onClick={() => setShowNotifications(true)}
                  className="relative p-1.5 md:p-2 rounded-candy-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 active:scale-95"
                  title="Сповіщення"
                >
                  <BellIcon className="w-4 h-4 md:w-5 md:h-5" />
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full candy-pink text-white text-[10px] font-black flex items-center justify-center shadow-soft-lg">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </button>
              )}
              {mounted && (
                <button
                  onClick={toggleTheme}
                  className="p-1.5 md:p-2 rounded-candy-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 active:scale-95"
                  title={theme === 'light' ? 'Увімкнути темну тему' : 'Увімкнути світлу тему'}
                >
                  {theme === 'light' ? (
                    <MoonIcon className="w-4 h-4 md:w-5 md:h-5" />
                  ) : (
                    <SunIcon className="w-4 h-4 md:w-5 md:h-5" />
                  )}
                </button>
              )}
              {business ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/qr/${business.slug}`, '_blank')}
                    className="hidden md:flex text-xs px-2 py-1 h-auto"
                  >
                    QR код
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="text-xs px-2 py-1 h-auto"
                  >
                    Вийти
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => router.push('/login')}
                  className="text-xs px-3 py-1.5 h-auto"
                >
                  Увійти
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>
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

