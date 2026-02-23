'use client'

import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { XbaseLogo } from '@/components/layout/XbaseLogo'

interface AuthLayoutProps {
  title: string
  children: React.ReactNode
}

export function AuthLayout({ title, children }: AuthLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const isLogin = pathname === '/login'

  return (
    <div className="relative min-h-screen overflow-x-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Той самий градієнт, що на головній */}
      <div className="fixed inset-0 pointer-events-none landing-hero-gradient" aria-hidden />

      {/* Хедер як на головній — touch-friendly на мобільному */}
      <header className="relative z-20 flex items-center justify-between pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 lg:px-8 py-4 sm:py-5">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="touch-target flex items-center min-h-[44px] min-w-[44px] rounded-lg active:scale-[0.98]"
          aria-label="На головну"
        >
          <XbaseLogo size="lg" variant="light" />
        </button>
        <nav className="flex items-center gap-1.5 sm:gap-3">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className={cn(
              'touch-target text-sm font-medium px-3 py-2.5 min-h-[44px] rounded-lg transition-colors',
              isLogin ? 'text-white bg-white/10' : 'text-gray-300 hover:text-white hover:bg-white/10'
            )}
          >
            Вхід
          </button>
          <button
            type="button"
            onClick={() => router.push('/register')}
            className={cn(
              'touch-target text-sm font-semibold px-4 py-2.5 min-h-[44px] rounded-lg transition-colors border border-white/20',
              !isLogin ? 'text-white bg-white/15' : 'text-gray-300 hover:text-white bg-white/10 hover:bg-white/20'
            )}
          >
            Реєстрація
          </button>
        </nav>
      </header>

      <main className="relative z-10 flex items-center justify-center px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] py-6 sm:py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl p-6 sm:p-8 card-glass-elevated border border-white/12 shadow-xl shadow-black/20">
            <div className="flex flex-col items-center mb-6">
              <div className="mb-4">
                <XbaseLogo size="lg" variant="light" />
              </div>
              <h1 className="landing-hero-title text-2xl sm:text-3xl font-bold text-white text-center" style={{ letterSpacing: '-0.02em' }}>
                {title}
              </h1>
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
