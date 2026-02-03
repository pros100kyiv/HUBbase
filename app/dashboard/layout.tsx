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
        // Показуємо модальне вікно, якщо профіль не заповнений
        if (!parsed.profileCompleted) {
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
    setBusiness(updatedBusiness)
    setShowProfileModal(false)
    // Оновлюємо localStorage
    if (updatedBusiness) {
      localStorage.setItem('business', JSON.stringify(updatedBusiness))
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Blurred Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1920')] bg-cover bg-center opacity-10 dark:opacity-20" />
        <div className="absolute inset-0 bg-white/80 dark:bg-black/60 backdrop-blur-xl" />
      </div>

      {/* Top Navbar */}
      <Navbar />
      
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Mobile Sidebar */}
      <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      
      {/* Main Content Area */}
      <main className="relative z-10 ml-0 md:ml-56 pt-10 md:pt-12 min-h-screen">
        <div className="p-2 md:p-3">
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

      {/* Profile Setup Modal */}
      {mounted && showProfileModal && business && (
        <ProfileSetupModal
          business={business}
          onComplete={handleProfileComplete}
        />
      )}
    </div>
  )
}



