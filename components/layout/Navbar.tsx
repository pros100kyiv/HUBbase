'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { SunIcon, MoonIcon } from '@/components/icons'

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

  // Don't show on dashboard pages (they have sidebar)
  if (pathname?.startsWith('/dashboard')) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700/50 shadow-soft-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center h-14 md:h-16">
            {/* Left side - Xbase Logo */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-candy-sm bg-gradient-to-r from-candy-blue to-candy-purple flex items-center justify-center text-white font-black text-xs md:text-sm shadow-soft-xl">
                X
              </div>
              <span className="text-xs md:text-sm font-black text-gray-900 dark:text-white hidden sm:block">
                Xbase
              </span>
            </div>

            {/* Center - Business name */}
            <div className="flex items-center justify-center flex-1 min-w-0">
              <div className="text-center">
                <h1 className="text-sm md:text-base font-black text-gray-900 dark:text-white truncate">
                  {business?.name || 'Dashboard'}
                </h1>
                {business?.phone && (
                  <p className="text-[10px] text-gray-600 dark:text-gray-400 truncate hidden md:block">
                    {business.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Right side - Actions */}
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
              {business && (
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
              )}
            </div>
          </div>
        </div>
      </nav>
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

