'use client'

import { useBooking } from '@/contexts/BookingContext'
import { InstallAppBadges } from '@/components/layout/InstallAppBadges'

interface Business {
  name?: string
  description?: string
}

interface LandingStepProps {
  business?: Business | null
}

export function LandingStep({ business }: LandingStepProps) {
  const { setStep } = useBooking()

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-12 px-4 pb-24 md:pb-12">
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <h1 className="text-xl sm:text-2xl md:text-4xl font-bold mb-3 text-white" style={{ letterSpacing: '-0.02em' }}>
          {business?.name || 'Бізнес'}
        </h1>
        <p className="text-sm md:text-base mb-6 md:mb-8 max-w-2xl mx-auto text-gray-300">
          {business?.description || 'Професійні послуги високої якості'}
        </p>
        <button
          type="button"
          className="px-6 md:px-8 py-3 md:py-4 rounded-lg bg-white text-black font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98] hidden md:inline-flex text-sm md:text-base"
          style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
          onClick={() => setStep(1)}
        >
          Запис онлайн
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 md:hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 space-y-2">
        <div className="flex justify-center">
          <InstallAppBadges variant="compact" />
        </div>
        <button
          type="button"
          className="w-full min-h-[48px] py-4 rounded-lg bg-white text-black font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98] text-sm touch-target"
          style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
          onClick={() => setStep(1)}
        >
          Запис онлайн
        </button>
      </div>

      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold text-xs md:text-sm">
          HUB
        </div>
        <span className="text-xs md:text-sm font-semibold text-white">HUBbase</span>
      </div>

      <div className="fixed top-4 left-4 z-20">
        <button
          type="button"
          className="px-3 py-2 rounded-lg border border-white/20 bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
          onClick={() => window.location.href = '/'}
        >
          ← Головна
        </button>
      </div>
    </div>
  )
}

