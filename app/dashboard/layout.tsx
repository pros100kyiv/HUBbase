'use client'

import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/admin/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Blurred Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1920')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" />
      </div>

      {/* Top Navbar */}
      <Navbar />
      
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <main className="relative z-10 ml-16 md:ml-40 pt-14 md:pt-16 min-h-screen">
        <div className="p-3 md:p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}



