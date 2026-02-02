'use client'

import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/admin/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Top Navbar */}
      <Navbar />
      
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <main className="ml-16 md:ml-40 pt-14 md:pt-16 min-h-screen">
        <div className="p-3 md:p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}



