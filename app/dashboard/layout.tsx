'use client'

import { useState } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/admin/Sidebar'
import { MobileSidebar } from '@/components/admin/MobileSidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
      <main className="relative z-10 ml-0 md:ml-64 pt-14 md:pt-16 min-h-screen">
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}



