'use client'

import { useBooking } from '@/contexts/BookingContext'
import { Button } from '@/components/ui/button'

interface Business {
  name?: string
  description?: string
  businessCardBackgroundImage?: string
  slogan?: string
  additionalInfo?: string
  socialMedia?: string
  location?: string
}

interface LandingStepProps {
  business?: Business | null
}

export function LandingStep({ business }: LandingStepProps) {
  const { setStep } = useBooking()

  const socialMedia = business?.socialMedia ? (() => {
    try {
      return JSON.parse(business.socialMedia)
    } catch {
      return {}
    }
  })() : {}

  return (
    <div 
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-900 dark:bg-gray-950"
      style={{
        backgroundImage: business?.businessCardBackgroundImage ? `url(${business.businessCardBackgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Background Overlay */}
      <div className="absolute inset-0 z-0">
        {business?.businessCardBackgroundImage ? (
          <div className="absolute inset-0 bg-black/60" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800/95 via-gray-900/95 to-gray-800/95 dark:from-gray-900/95 dark:via-gray-950/95 dark:to-gray-900/95" />
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-black mb-4 text-white drop-shadow-lg">
          {business?.name || 'Бізнес'}
        </h1>
        {business?.slogan && (
          <p className="text-xl md:text-2xl font-bold mb-4 text-white/90 drop-shadow-md">
            {business.slogan}
          </p>
        )}
        <p className="text-base md:text-lg mb-4 max-w-2xl mx-auto text-white/80 drop-shadow-md">
          {business?.description || 'Професійні послуги високої якості'}
        </p>
        {business?.location && (
          <p className="text-sm md:text-base mb-4 text-white/70 flex items-center justify-center gap-2">
            <span>📍</span>
            {business.location}
          </p>
        )}
        {business?.additionalInfo && (
          <p className="text-sm md:text-base mb-6 max-w-2xl mx-auto text-white/70">
            {business.additionalInfo}
          </p>
        )}
        {(socialMedia.facebook || socialMedia.instagram || socialMedia.telegram) && (
          <div className="flex gap-4 justify-center mb-6">
            {socialMedia.facebook && (
              <a 
                href={socialMedia.facebook} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white/80 hover:text-white transition-colors"
              >
                📘 Facebook
              </a>
            )}
            {socialMedia.instagram && (
              <a 
                href={socialMedia.instagram} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white/80 hover:text-white transition-colors"
              >
                📷 Instagram
              </a>
            )}
            {socialMedia.telegram && (
              <a 
                href={socialMedia.telegram.startsWith('@') ? `https://t.me/${socialMedia.telegram.slice(1)}` : socialMedia.telegram} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white/80 hover:text-white transition-colors"
              >
                ✈️ Telegram
              </a>
            )}
          </div>
        )}
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

      {/* Xbase Logo at top center */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-20">
        <XbaseLogo size="md" showText={true} className="text-white" />
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

