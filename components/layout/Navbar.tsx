'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useEffect, useState, useRef } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useNavigationProgress } from '@/contexts/NavigationProgressContext'
import { SunIcon, MoonIcon, OledIcon, MenuIcon, QRIcon } from '@/components/icons'
import { setMobileMenuState } from '@/app/dashboard/layout'
import { AccountInfo } from '@/components/layout/AccountInfo'
import { GlobalSearch } from '@/components/admin/GlobalSearch'
import { AccountProfileButton } from '@/components/layout/AccountProfileButton'
import { NotificationsPanel } from '@/components/admin/NotificationsPanel'

export function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [business, setBusiness] = useState<any>(null)
  let theme: 'light' | 'dark' | 'oled' = 'light'
  let cycleTheme: () => void = () => {}
  let mounted = false

  try {
    const themeContext = useTheme()
    theme = themeContext.theme
    cycleTheme = themeContext.cycleTheme
    mounted = themeContext.mounted
  } catch (e) {
    // ThemeProvider not available, use default
  }

  const themeTitles: Record<string, string> = {
    light: 'Світла тема',
    dark: 'Темна тема',
    oled: 'OLED тема (чорний)',
  }

  useEffect(() => {
    const loadBusiness = () => {
      const businessData = localStorage.getItem('business')
      if (!businessData) {
        setBusiness(null)
        return
      }
      try {
        const next = JSON.parse(businessData)
        // Avoid rerender loops: only update when actually changed
        setBusiness((prev: any) => {
          const prevId = prev?.id
          const nextId = next?.id
          const prevSlug = prev?.slug
          const nextSlug = next?.slug
          return prevId === nextId && prevSlug === nextSlug ? prev : next
        })
      } catch {
        setBusiness(null)
      }
    }
    
    loadBusiness()

    // Update when localStorage changes in another tab/window
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'business') loadBusiness()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [pathname])

  const { startNavigation } = useNavigationProgress()

  const handleLogout = () => {
    localStorage.removeItem('business')
    setBusiness(null)
    startNavigation()
    router.push('/login')
  }

  // Не показувати навігацію на головній, реєстрації та логіні
  if (pathname === '/' || pathname === '/register' || pathname === '/login') {
    return null
  }

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const searchButtonRef = useRef<HTMLButtonElement>(null)

  // Close mobile menu when pathname changes
  useEffect(() => {
    if (mobileMenuOpen && pathname) {
      setMobileMenuOpen(false)
      setMobileMenuState(false)
    }
  }, [pathname])

  // Швидкий виклик пошуку: Ctrl+K / Cmd+K (тільки на dashboard)
  useEffect(() => {
    if (!pathname?.startsWith('/dashboard')) return
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [pathname])

  // Don't show on dashboard pages (they have sidebar)
  if (pathname?.startsWith('/dashboard')) {
    return (
      <>
        <nav className="fixed top-0 left-0 md:left-64 right-0 z-50 border-b safe-top navbar-theme pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          <div className="px-2 sm:px-3 md:px-6">
            <div className="flex justify-between items-center h-14 md:h-16 gap-2">
              {/* Left side - Menu button (mobile) and Hi User */}
              <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                <button
                  onClick={() => {
                    const newState = !mobileMenuOpen
                    setMobileMenuOpen(newState)
                    setMobileMenuState(newState)
                  }}
                  className="md:hidden touch-target p-2.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0 flex items-center justify-center"
                  aria-label="Відкрити меню"
                >
                  <MenuIcon className="w-5 h-5 text-white" />
                </button>
                
                <h2 className="text-sm md:text-base font-medium text-white truncate" style={{ letterSpacing: '-0.01em' }}>
                  {business?.name || 'Hi, User!'}
                </h2>
              </div>

              {/* Right side - Actions */}
              <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0">
                {/* Тема: швидке керування — першим у панелі */}
                {mounted && (
                  <button
                    onClick={cycleTheme}
                    className="touch-target p-2.5 rounded-lg hover:bg-white/10 transition-colors border border-white/10 flex items-center justify-center flex-shrink-0"
                    title={themeTitles[theme] || 'Тема'}
                    aria-label={themeTitles[theme] || 'Змінити тему'}
                  >
                    {theme === 'light' && <MoonIcon className="w-5 h-5 text-white" />}
                    {theme === 'dark' && <SunIcon className="w-5 h-5 text-white" />}
                    {theme === 'oled' && <OledIcon className="w-5 h-5 text-white" />}
                  </button>
                )}
                {/* Записати — на мобільному компактно, на десктопі повний текст */}
                <button 
                  onClick={() => { startNavigation(); router.push('/dashboard/appointments?create=true') }}
                  className="touch-target flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98]" 
                  style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
                  aria-label="Новий запис"
                >
                  <svg className="w-4 h-4 md:w-4 md:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Записати</span>
                </button>
                
                {/* QR Code - open QR page for booking */}
                {business?.slug && (
                  <button
                    onClick={() => window.open(`/qr/${business.slug}`, '_blank')}
                    className="touch-target p-2.5 rounded-lg hover:bg-white/10 transition-colors border border-white/10 flex items-center justify-center"
                    title="QR код для бронювання"
                    aria-label="QR код для бронювання"
                  >
                    <QRIcon className="w-5 h-5 text-white" />
                  </button>
                )}
                {/* Search Button — ref для позиціонування модалки пошука */}
                <button
                  ref={searchButtonRef}
                  onClick={() => setSearchOpen(true)}
                  className="touch-target p-2.5 md:px-3 md:py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-2 border border-white/10"
                  aria-label="Пошук"
                >
                  <svg className="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="text-sm text-gray-300 hidden md:block">Пошук</span>
                </button>

                {/* Global Search Modal — відкривається біля кнопки пошука */}
                {business && (
                  <GlobalSearch
                    businessId={business.id}
                    isOpen={searchOpen}
                    onClose={() => setSearchOpen(false)}
                    anchorRef={searchButtonRef}
                  />
                )}
                
                {/* Notifications Icon */}
                <button
                  onClick={() => setShowNotifications(true)}
                  className="touch-target p-2.5 rounded-lg hover:bg-white/10 transition-colors relative flex items-center justify-center"
                  title="Сповіщення"
                  aria-label="Сповіщення"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {business && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </button>
                {business?.id && (
                  <NotificationsPanel
                    businessId={business.id}
                    isOpen={showNotifications}
                    onClose={() => setShowNotifications(false)}
                    onUpdate={() => {}}
                  />
                )}
                {/* Profile Icon with Dropdown */}
                {business && <AccountProfileButton business={business} router={router} />}
              </div>
            </div>
          </div>
        </nav>
      </>
    )
  }

  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-800/50 shadow-soft">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-14 md:h-16">
          {/* Left side - Xbase Logo (clickable, redirects to home) */}
          <button
            onClick={() => { startNavigation(); router.push('/') }}
            className="flex items-center gap-2 flex-shrink-0 hover:opacity-90 transition-opacity active:scale-[0.98]"
            title="На головну"
            aria-label="На головну"
          >
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-candy-sm candy-purple flex items-center justify-center text-white font-black text-xs md:text-sm shadow-soft-lg">
              X
            </div>
            <span className="text-xs md:text-sm font-black text-foreground dark:text-white hidden sm:block">
              Xbase
            </span>
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
                  onClick={() => { startNavigation(); router.push('/dashboard') }}
                  className={`px-2.5 py-1 rounded-candy-xs text-xs font-bold transition-all duration-200 ${
                    pathname === '/dashboard' 
                      ? 'candy-purple text-white shadow-soft-lg' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  Панель
                </button>
                <button
                  onClick={() => { startNavigation(); router.push('/dashboard/settings') }}
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
            {/* Тема: швидке керування у верхній панелі */}
            {mounted && (
              <button
                onClick={cycleTheme}
                className="touch-target p-2 rounded-candy-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 active:scale-95 flex items-center justify-center"
                title={themeTitles[theme] || 'Тема'}
                aria-label={themeTitles[theme] || 'Змінити тему'}
              >
                {theme === 'light' && <MoonIcon className="w-4 h-4 md:w-5 md:h-5" />}
                {theme === 'dark' && <SunIcon className="w-4 h-4 md:w-5 md:h-5" />}
                {theme === 'oled' && <OledIcon className="w-4 h-4 md:w-5 md:h-5" />}
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
                onClick={() => { startNavigation(); router.push('/login') }}
                className="text-xs px-3 py-1.5 h-auto"
              >
                Увійти
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

