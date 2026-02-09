'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/admin/Sidebar'
import { MobileSidebar } from '@/components/admin/MobileSidebar'
import { AIChatWidget } from '@/components/ai/AIChatWidget'
import { ProfileSetupModal } from '@/components/admin/ProfileSetupModal'
import { BlockedOverlay } from '@/components/admin/BlockedOverlay'
import { useNavigationProgress } from '@/contexts/NavigationProgressContext'

// Global state for mobile menu
let globalMobileMenuState = { isOpen: false, setIsOpen: (open: boolean) => {} }

export function setMobileMenuState(isOpen: boolean) {
  if (globalMobileMenuState.setIsOpen) {
    globalMobileMenuState.setIsOpen(isOpen)
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { startNavigation } = useNavigationProgress()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [business, setBusiness] = useState<any>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isBlocked, setIsBlocked] = useState<boolean | null>(null)
  const [blockInfo, setBlockInfo] = useState<{ reason?: string; blockedAt?: string } | null>(null)

  useEffect(() => {
    setMounted(true)
    const businessData = localStorage.getItem('business')
    if (businessData) {
      try {
        const parsed = JSON.parse(businessData)
        setBusiness(parsed)
        const profileModalClosed = localStorage.getItem('profileModalClosed')
        if (!parsed.profileCompleted && !profileModalClosed) {
          setShowProfileModal(true)
        }
      } catch (e) {
        console.error('Error parsing business data:', e)
      }
    }
  }, [])

  // Перевірка статусу блокування при завантаженні бізнесу
  useEffect(() => {
    if (!business?.id) {
      setIsBlocked(null)
      setBlockInfo(null)
      return
    }
    fetch(`/api/business/block?businessId=${encodeURIComponent(business.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.business?.isActive === false && data?.blockInfo) {
          setIsBlocked(true)
          setBlockInfo({
            reason: data.blockInfo.reason,
            blockedAt: data.blockInfo.blockedAt,
          })
        } else {
          setIsBlocked(false)
          setBlockInfo(null)
        }
      })
      .catch(() => {
        setIsBlocked(false)
        setBlockInfo(null)
      })
  }, [business?.id])

  useEffect(() => {
    globalMobileMenuState = { isOpen: mobileMenuOpen, setIsOpen: setMobileMenuOpen }
  }, [mobileMenuOpen])

  // Heartbeat для статусу онлайн/офлайн в Центрі управління
  useEffect(() => {
    const businessData = localStorage.getItem('business')
    if (!businessData) return

    let businessId: string | null = null
    try {
      const parsed = JSON.parse(businessData)
      businessId = parsed?.id || null
    } catch {
      return
    }
    if (!businessId) return

    const sendHeartbeat = () => {
      if (document.visibilityState !== 'visible') return
      fetch('/api/business/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      }).catch(() => {})
    }

    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 180_000) // 3 хв — економія compute (Neon sleep)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') sendHeartbeat()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  const handleProfileComplete = (updatedBusiness: any) => {
    if (updatedBusiness) {
      setBusiness(updatedBusiness)
      // Оновлюємо localStorage
      localStorage.setItem('business', JSON.stringify(updatedBusiness))
      // Закриваємо модальне вікно тільки якщо профіль заповнений
      if (updatedBusiness.profileCompleted) {
        setShowProfileModal(false)
        // Видаляємо прапорець закриття, оскільки профіль тепер заповнений
        localStorage.removeItem('profileModalClosed')
      }
    }
  }

  const handleProfileModalClose = () => {
    // Зберігаємо прапорець, що користувач закрив вікно вручну
    localStorage.setItem('profileModalClosed', 'true')
    setShowProfileModal(false)
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Той самий фон, що на реєстрації, вході та головній — м’які градієнтні орби */}
      <div className="fixed inset-0 pointer-events-none landing-hero-gradient" aria-hidden />

      {/* Оверлей «Доступ заблоковано» — показується, коли акаунт заблоковано в центрі управління */}
      {mounted && isBlocked === true && (
        <BlockedOverlay
          blockReason={blockInfo?.reason}
          blockedAt={blockInfo?.blockedAt}
        />
      )}

      {/* Top Navbar */}
      <Navbar />
      
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Mobile Sidebar */}
      <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      
      {/* Main Content Area — safe-area для notch та home indicator */}
      <main className="relative ml-0 md:ml-64 pt-14 md:pt-16 min-h-screen safe-bottom pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <div className="px-3 py-3 md:p-6 pb-[max(5rem,env(safe-area-inset-bottom)+3.5rem)] md:pb-6">
          {children}
        </div>
      </main>

      {/* FAB «Записати» — тільки на мобільному в dashboard */}
      <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 md:hidden">
        <button
          type="button"
          onClick={() => {
            startNavigation()
            router.push('/dashboard/appointments?create=true')
          }}
          className="touch-target flex items-center justify-center w-14 h-14 rounded-full bg-white text-black shadow-lg hover:bg-gray-100 active:scale-95 transition-all"
          style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}
          aria-label="Новий запис"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* AI Chat Widget — тільки після mount (уникнення hydration #418) */}
      {mounted && (() => {
        try {
          const businessData = localStorage.getItem('business')
          if (businessData) {
            const business = JSON.parse(businessData)
            if (business?.id) {
              return <AIChatWidget businessId={business.id} />
            }
          }
        } catch {}
        return null
      })()}

      {/* Profile Setup Modal - показується тільки при першій реєстрації */}
      {mounted && showProfileModal && business && !business.profileCompleted && (
        <ProfileSetupModal
          business={business}
          onComplete={handleProfileComplete}
          onClose={handleProfileModalClose}
        />
      )}
    </div>
  )
}



