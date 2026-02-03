'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { SunIcon, MoonIcon, MenuIcon } from '@/components/icons'
import { setMobileMenuState } from '@/app/dashboard/layout'
import { AccountInfo } from '@/components/layout/AccountInfo'

// Оновлюємо бізнес при зміні localStorage
if (typeof window !== 'undefined') {
  window.addEventListener('storage', () => {
    window.location.reload()
  })
}

export function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [business, setBusiness] = useState<any>(null)
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
          setBusiness(JSON.parse(businessData))
        } catch {}
      }
    }
    
    loadBusiness()
    
    // Оновлюємо при зміні pathname (наприклад після логіну)
    const interval = setInterval(loadBusiness, 1000)
    return () => clearInterval(interval)
  }, [pathname])

  const handleLogout = () => {
    localStorage.removeItem('business')
    setBusiness(null)
    router.push('/login')
  }

  // Не показувати навігацію на головній, реєстрації та логіні
  if (pathname === '/' || pathname === '/register' || pathname === '/login') {
    return null
  }

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu when pathname changes
  useEffect(() => {
    if (mobileMenuOpen && pathname) {
      setMobileMenuOpen(false)
      setMobileMenuState(false)
    }
  }, [pathname])

  // Don't show on dashboard pages (they have sidebar)
  if (pathname?.startsWith('/dashboard')) {
    return (
      <>
        <nav className="fixed top-0 left-0 md:left-64 right-0 z-50 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="px-4 lg:px-6">
            <div className="flex justify-between items-center h-16">
              {/* Left side - Menu button (mobile) and Search */}
              <div className="flex items-center gap-4 flex-1">
                <button
                  onClick={() => {
                    const newState = !mobileMenuOpen
                    setMobileMenuOpen(newState)
                    setMobileMenuState(newState)
                  }}
                  className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  aria-label="Відкрити меню"
                >
                  <MenuIcon className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                </button>
                
                {/* Search Bar */}
                <div className="hidden md:flex items-center flex-1 max-w-md">
                  <div className="relative w-full">
                    <input
                      type="text"
                      placeholder="Search placeholder"
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Right side - Actions */}
              <div className="flex items-center gap-3">
                {/* Chat Icon */}
                <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors relative">
                  <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>
                
                {/* Notifications Icon */}
                <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors relative">
                  <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {business && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </button>
                
                {/* Theme Toggle */}
                {mounted && (
                  <button
                    onClick={toggleTheme}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200"
                    title={theme === 'light' ? 'Увімкнути темну тему' : 'Увімкнути світлу тему'}
                  >
                    {theme === 'light' ? (
                      <MoonIcon className="w-5 h-5" />
                    ) : (
                      <SunIcon className="w-5 h-5" />
                    )}
                  </button>
                )}
                
                {/* Profile */}
                {business && (
                  <div className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-700">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{business.name || 'User'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{business.email?.split('@')[0] || 'Admin'}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold shadow-md">
                      {business.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  </div>
                )}
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
          {/* Left side - Xbase Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-candy-sm candy-purple flex items-center justify-center text-white font-black text-xs md:text-sm shadow-soft-lg">
              X
            </div>
            <span className="text-xs md:text-sm font-black text-foreground dark:text-white hidden sm:block">
              Xbase
            </span>
          </div>

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
  )
}

