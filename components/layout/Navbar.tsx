'use client'

import dynamic from 'next/dynamic'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useEffect, useState, useRef } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useNavigationProgress } from '@/contexts/NavigationProgressContext'
import { SunIcon, MoonIcon, OledIcon, MenuIcon, QRIcon } from '@/components/icons'
import { setMobileMenuState, getMobileMenuState } from '@/lib/ui/mobile-menu-state'
import { playNotificationSound } from '@/lib/notification-sound'
import { AccountProfileButton } from '@/components/layout/AccountProfileButton'
import { XbaseLogo } from '@/components/layout/XbaseLogo'

const GlobalSearch = dynamic(
  () => import('@/components/admin/GlobalSearch').then((m) => ({ default: m.GlobalSearch })),
  { ssr: false }
)

const NotificationsPanel = dynamic(
  () => import('@/components/admin/NotificationsPanel').then((m) => ({ default: m.NotificationsPanel })),
  { ssr: false }
)

export function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [business, setBusiness] = useState<any>(null)

  // Defensive: during dev/HMR we have seen cases where the imported functions are not functions.
  // Don't crash the whole dashboard if that happens.
  const safeGetMobileMenuState = () => {
    try {
      return typeof getMobileMenuState === 'function' ? getMobileMenuState() : false
    } catch {
      return false
    }
  }
  const safeSetMobileMenuState = (open: boolean) => {
    try {
      if (typeof setMobileMenuState === 'function') setMobileMenuState(open)
    } catch {
      // ignore
    }
  }

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

  const [searchOpen, setSearchOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const prevPendingRef = useRef<number | null>(null)
  const pendingPollTimeoutRef = useRef<number | null>(null)
  const pendingPollAbortRef = useRef<AbortController | null>(null)

  // Pending appointments count; звук при появі нового запису (червона точка з’являється)
  useEffect(() => {
    if (!business?.id || !pathname?.startsWith('/dashboard')) return
    let disposed = false

    const clearPendingPoll = () => {
      if (pendingPollTimeoutRef.current != null) {
        window.clearTimeout(pendingPollTimeoutRef.current)
        pendingPollTimeoutRef.current = null
      }
      if (pendingPollAbortRef.current) {
        pendingPollAbortRef.current.abort()
        pendingPollAbortRef.current = null
      }
    }

    const fetchPending = async () => {
      try {
        // Avoid piling up requests on slower devices (iOS Safari).
        clearPendingPoll()
        if (disposed) return
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return

        const ac = new AbortController()
        pendingPollAbortRef.current = ac
        const res = await fetch(`/api/appointments?businessId=${business.id}&status=Pending`, { signal: ac.signal })
        if (!res.ok) return
        const data = await res.json()
        const count = Array.isArray(data) ? data.length : 0
        const prevVal = prevPendingRef.current
        prevPendingRef.current = count
        if (prevVal !== null && count > prevVal && typeof document !== 'undefined' && document.visibilityState === 'visible') {
          playNotificationSound()
        }
        setPendingCount(count)
      } catch {
        setPendingCount(0)
        prevPendingRef.current = 0
      }
    }

    const scheduleNext = (ms: number) => {
      if (disposed) return
      pendingPollTimeoutRef.current = window.setTimeout(() => {
        fetchPending().finally(() => {
          // Schedule the next run only after this one finishes.
          scheduleNext(180_000) // 3 хв
        })
      }, ms)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchPending()
      }
    }

    // Initial fetch + lightweight polling
    fetchPending()
    scheduleNext(180_000)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibility)
      clearPendingPoll()
    }
  }, [business?.id, pathname])

  // Close mobile menu when pathname changes
  useEffect(() => {
    if (safeGetMobileMenuState() && pathname) {
      safeSetMobileMenuState(false)
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
          <div className="px-3 sm:px-4 md:px-6">
            <div className="flex justify-between items-center h-14 md:h-16 gap-2">
              {/* Left: меню (mobile) + назва бізнесу */}
              <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                <button
                  onClick={() => safeSetMobileMenuState(!safeGetMobileMenuState())}
                  className="md:hidden touch-target p-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors flex-shrink-0 flex items-center justify-center"
                  aria-label="Відкрити меню"
                  title="Меню"
                >
                  <MenuIcon className="w-5 h-5 text-white" />
                </button>
                <h2 className="text-sm md:text-base font-semibold text-white truncate" style={{ letterSpacing: '-0.02em' }}>
                  {business?.name || 'Кабінет'}
                </h2>
              </div>

              {/* Right: дії — згруповані візуально */}
              <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
                {/* Група: тема + іконки */}
                <div className={`flex items-center gap-1 sm:gap-1.5 md:gap-2 mounted-fade-in ${mounted ? 'visible' : ''}`}>
                  <button
                    onClick={cycleTheme}
                    className="touch-target p-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors border border-white/10 flex items-center justify-center flex-shrink-0 w-10 h-10"
                    title={themeTitles[theme] || 'Тема'}
                    aria-label={themeTitles[theme] || 'Змінити тему'}
                  >
                    {theme === 'light' && <MoonIcon className="w-5 h-5 text-white" />}
                    {theme === 'dark' && <SunIcon className="w-5 h-5 text-white" />}
                    {theme === 'oled' && <OledIcon className="w-5 h-5 text-white" />}
                  </button>
                  {business?.slug && (
                    <button
                      onClick={() => window.open(`/qr/${business.slug}`, '_blank')}
                      className="touch-target p-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors border border-white/10 flex items-center justify-center"
                      title="QR код для бронювання"
                      aria-label="QR код для бронювання"
                    >
                      <QRIcon className="w-5 h-5 text-white" />
                    </button>
                  )}
                  <button
                    ref={searchButtonRef}
                    onClick={() => setSearchOpen(true)}
                    className="touch-target p-2.5 md:px-3 md:py-2 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors flex items-center justify-center gap-2 border border-white/10"
                    title="Пошук (Ctrl+K)"
                    aria-label="Пошук (Ctrl+K)"
                  >
                    <svg className="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="text-sm text-gray-300 hidden md:inline">Пошук</span>
                  </button>
                  <button
                    onClick={() => setShowNotifications(true)}
                    className="touch-target p-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors relative flex items-center justify-center"
                    title={pendingCount > 0 ? `Сповіщення (${pendingCount})` : 'Сповіщення'}
                    aria-label={pendingCount > 0 ? `Сповіщення: ${pendingCount}` : 'Сповіщення'}
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {business && pendingCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                  </button>
                </div>

                {business && (
                  <GlobalSearch
                    businessId={business.id}
                    isOpen={searchOpen}
                    onClose={() => setSearchOpen(false)}
                    anchorRef={searchButtonRef}
                  />
                )}
                {business?.id && (
                  <NotificationsPanel
                    businessId={business.id}
                    isOpen={showNotifications}
                    onClose={() => setShowNotifications(false)}
                    onUpdate={() => {
                      if (business?.id) {
                        fetch(`/api/appointments?businessId=${business.id}&status=Pending`)
                          .then((r) => r.json())
                          .then((d) => setPendingCount(Array.isArray(d) ? d.length : 0))
                          .catch(() => setPendingCount(0))
                      }
                    }}
                  />
                )}

                {/* Роздільник перед головною дією */}
                <div className="w-px h-6 bg-white/10 hidden sm:block flex-shrink-0" aria-hidden />

                {/* Головна дія: Записати */}
                <button
                  onClick={() => { startNavigation(); router.push('/dashboard/appointments?create=true') }}
                  className="touch-target flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 bg-white text-black rounded-xl text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98]"
                  style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}
                  aria-label="Новий запис"
                  title="Новий запис"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Записати</span>
                </button>

                {/* Профіль */}
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
          {/* Left side - Xbase Logo (тільки значок, без фону) */}
          <button
            onClick={() => { startNavigation(); router.push('/') }}
            className="flex items-center flex-shrink-0 hover:opacity-90 transition-opacity active:scale-[0.98]"
            title="На головну"
            aria-label="На головну"
          >
            <XbaseLogo size="md" />
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

          <div className={`flex items-center gap-2 flex-shrink-0 mounted-fade-in ${mounted ? 'visible' : ''}`}>
            {/* Тема: швидке керування у верхній панелі */}
            <button
              onClick={cycleTheme}
              className="touch-target p-2 rounded-candy-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 active:scale-95 flex items-center justify-center w-9 h-9 md:w-10 md:h-10"
              title={themeTitles[theme] || 'Тема'}
              aria-label={themeTitles[theme] || 'Змінити тему'}
            >
              {theme === 'light' && <MoonIcon className="w-4 h-4 md:w-5 md:h-5" />}
              {theme === 'dark' && <SunIcon className="w-4 h-4 md:w-5 md:h-5" />}
              {theme === 'oled' && <OledIcon className="w-4 h-4 md:w-5 md:h-5" />}
            </button>
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

