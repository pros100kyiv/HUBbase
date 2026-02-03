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
      
      {/* Main Content Area */}
      <main className="relative ml-0 md:ml-64 pt-16 min-h-screen" style={{ backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)' }}>
        <div className="p-6">
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



