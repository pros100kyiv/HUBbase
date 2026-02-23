'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { useNavigationProgress } from '@/contexts/NavigationProgressContext'
import { registerMobileMenuState } from '@/lib/ui/mobile-menu-state'
import { getBusinessData, setBusinessData } from '@/lib/business-storage'

const Sidebar = dynamic(
  () => import('@/components/admin/Sidebar').then((m) => ({ default: m.Sidebar })),
  { ssr: false, loading: () => <div className="hidden md:block fixed left-0 top-14 bottom-0 w-64 bg-white/5 animate-pulse" aria-hidden /> }
)

const MobileSidebar = dynamic(
  () => import('@/components/admin/MobileSidebar').then((m) => ({ default: m.MobileSidebar })),
  { ssr: false }
)

const AIChatWidget = dynamic(
  () => import('@/components/ai/AIChatWidget').then((m) => ({ default: m.AIChatWidget })),
  { ssr: false }
)

const ProfileSetupModal = dynamic(
  () => import('@/components/admin/ProfileSetupModal').then((m) => ({ default: m.ProfileSetupModal })),
  { ssr: false }
)

const BlockedOverlay = dynamic(
  () => import('@/components/admin/BlockedOverlay').then((m) => ({ default: m.BlockedOverlay })),
  { ssr: false }
)

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { startNavigation } = useNavigationProgress()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [business, setBusiness] = useState<any>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isBlocked, setIsBlocked] = useState<boolean | null>(null)
  const [blockInfo, setBlockInfo] = useState<{ reason?: string; blockedAt?: string } | null>(null)
  useEffect(() => {
    setMounted(true)
    const businessData = getBusinessData()
    if (businessData) {
      try {
        const parsed = JSON.parse(businessData)
        setBusiness(parsed)
        const profileModalClosed = localStorage.getItem('profileModalClosed')
        const forceShowProfile = localStorage.getItem('showProfileModal') === '1'
        if (forceShowProfile) {
          localStorage.removeItem('showProfileModal')
          setShowProfileModal(true)
        } else if (!parsed.profileCompleted && !profileModalClosed) {
          setShowProfileModal(true)
        }
      } catch (e) {
        console.error('Error parsing business data:', e)
      }
    }
  }, [])

  // Перевірка статусу блокування — відкладаємо після першого малювання, щоб не гальмувати завантаження
  useEffect(() => {
    if (!business?.id) {
      setIsBlocked(null)
      setBlockInfo(null)
      return
    }
    const id = setTimeout(() => {
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
    }, 0)
    return () => clearTimeout(id)
  }, [business?.id])

  // useLayoutEffect: реєструємо setter ДО малювання, щоб перший клік відразу відкривав меню (без подвійного натискання)
  useLayoutEffect(() => {
    registerMobileMenuState(mobileMenuOpen, setMobileMenuOpen)
  }, [mobileMenuOpen])

  // Heartbeat для статусу онлайн/офлайн в Центрі управління
  useEffect(() => {
    const businessData = getBusinessData()
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
      setBusinessData(updatedBusiness)
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
    <div className="relative min-h-screen w-full min-w-0 max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Той самий фон, що на реєстрації, вході та головній — м’які градієнтні орби */}
      <div className="fixed inset-0 pointer-events-none landing-hero-gradient" aria-hidden />

      {/* Оверлей «Доступ заблоковано» — плавна поява */}
      {mounted && isBlocked === true && (
        <div className="mounted-fade-in visible">
          <BlockedOverlay
            blockReason={blockInfo?.reason}
            blockedAt={blockInfo?.blockedAt}
          />
        </div>
      )}

      {/* Top Navbar */}
      <Navbar />
      
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Mobile Sidebar */}
      <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      
      {/* Main Content Area — на десктопі ширина = viewport − сайдбар, щоб контент не виходив за екран */}
      <main className="relative w-full min-w-0 max-w-full overflow-x-hidden ml-0 md:ml-64 md:w-[calc(100vw-16rem)] pt-14 md:pt-16 min-h-screen safe-bottom pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]" data-dashboard-content>
        <div className="dashboard-content-inner w-full min-w-0 max-w-full overflow-x-hidden px-3 py-3 md:pl-8 md:pr-6 md:pt-6 md:pb-6 pb-[max(5rem,env(safe-area-inset-bottom)+3.5rem)] animate-content-fade-in">
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

      {/* AI Chat Widget — тимчасово приховано */}
      {false && mounted && (() => {
        try {
          const businessData = getBusinessData() ?? ''
          if (businessData) {
            const business = JSON.parse(businessData)
            if (business?.id) {
              return (
                <div className="mounted-fade-in visible">
                  <AIChatWidget businessId={business.id} />
                </div>
              )
            }
          }
        } catch {}
        return null
      })()}

      {/* Profile Setup Modal — плавна поява */}
      {mounted && showProfileModal && business && !business.profileCompleted && (
        <div className="mounted-fade-in visible">
          <ProfileSetupModal
            business={business}
            onComplete={handleProfileComplete}
            onClose={handleProfileModalClose}
          />
        </div>
      )}
    </div>
  )
}



