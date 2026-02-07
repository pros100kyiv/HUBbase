'use client'

import { useState, useEffect } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/admin/Sidebar'
import { MobileSidebar } from '@/components/admin/MobileSidebar'
import { AIChatWidget } from '@/components/ai/AIChatWidget'
import { ProfileSetupModal } from '@/components/admin/ProfileSetupModal'

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [business, setBusiness] = useState<any>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const businessData = localStorage.getItem('business')
    if (businessData) {
      try {
        const parsed = JSON.parse(businessData)
        setBusiness(parsed)
        
        // Перевіряємо, чи користувач вже закривав це вікно
        const profileModalClosed = localStorage.getItem('profileModalClosed')
        
        // Показуємо модальне вікно ТІЛЬКИ якщо:
        // 1. Профіль не заповнений
        // 2. Користувач ще не закривав це вікно вручну
        if (!parsed.profileCompleted && !profileModalClosed) {
          setShowProfileModal(true)
        }
      } catch (e) {
        console.error('Error parsing business data:', e)
      }
    }
  }, [])

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
    const interval = setInterval(sendHeartbeat, 30_000)

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
    <div className="relative min-h-screen" style={{ backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)' }}>
      {/* Top Navbar */}
      <Navbar />
      
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Mobile Sidebar */}
      <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      
      {/* Main Content Area — safe-area для notch та home indicator */}
      <main className="relative ml-0 md:ml-64 pt-14 md:pt-16 min-h-screen safe-bottom pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]" style={{ backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)' }}>
        <div className="px-3 py-3 md:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:pb-6">
          {children}
        </div>
      </main>

      {/* AI Chat Widget */}
      {typeof window !== 'undefined' && (() => {
        const businessData = localStorage.getItem('business')
        if (businessData) {
          try {
            const business = JSON.parse(businessData)
            if (business?.id) {
              return <AIChatWidget businessId={business.id} />
            }
          } catch {}
        }
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



