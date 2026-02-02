'use client'

import { useBooking } from '@/contexts/BookingContext'
import { Button } from '@/components/ui/button'

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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-900 dark:bg-gray-950">
      {/* Background - Soft dark gradient */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800/95 via-gray-900/95 to-gray-800/95 dark:from-gray-900/95 dark:via-gray-950/95 dark:to-gray-900/95" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-black mb-4 text-white" style={{ color: '#FFFFFF' }}>
          {business?.name || 'Бізнес'}
        </h1>
        <p className="text-base md:text-lg mb-8 max-w-2xl mx-auto" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
          {business?.description || 'Професійні послуги високої якості'}
        </p>
        <Button
          size="lg"
          className="btn-primary btn-pulse text-sm md:text-base px-8 md:px-12 py-3 md:py-4 hidden md:inline-flex"
          onClick={() => setStep(1)}
        >
          ЗАПИС ОНЛАЙН
        </Button>
      </div>

      {/* Floating Button for Mobile */}
      <div className="fixed bottom-8 left-0 right-0 z-20 md:hidden px-4">
        <Button
          size="lg"
          className="btn-primary btn-pulse w-full text-sm py-4"
          onClick={() => setStep(1)}
        >
          ЗАПИС ОНЛАЙН
        </Button>
      </div>

      {/* HUBbase Logo at top center */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-2">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-candy-sm candy-purple flex items-center justify-center text-white font-black text-xs md:text-sm shadow-soft-lg">
          HUB
        </div>
        <span className="text-xs md:text-sm font-black text-white">
          HUBbase
        </span>
      </div>

      {/* Back to home button */}
      <div className="fixed top-4 left-4 z-20">
        <Button
          variant="outline"
          size="sm"
          className="btn-secondary text-xs px-3 py-1.5"
          onClick={() => window.location.href = '/'}
        >
          ← Головна
        </Button>
      </div>
    </div>
  )
}

