'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function Home() {
  const router = useRouter()

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-900 dark:bg-gray-950">
      {/* Background - Soft dark gradient */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800/95 via-gray-900/95 to-gray-800/95 dark:from-gray-900/95 dark:via-gray-950/95 dark:to-gray-900/95" />
      </div>

      {/* Xbase Logo at top center */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-2">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-candy-sm candy-blue flex items-center justify-center text-white font-black text-xs md:text-sm shadow-soft-lg">
          X
        </div>
        <span className="text-xs md:text-sm font-black text-white">
          Xbase
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-black mb-4 text-white" style={{ color: '#FFFFFF' }}>
          СИСТЕМА БРОНЮВАННЯ
        </h1>
        <p className="text-base md:text-lg mb-8 max-w-2xl mx-auto" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
          SaaS платформа для управління записами клієнтів
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-6">
          <Button
            size="lg"
            className="btn-primary btn-pulse text-sm md:text-base px-8 md:px-12 py-3 md:py-4"
            onClick={() => router.push('/register')}
          >
            РЕЄСТРАЦІЯ БІЗНЕСУ
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="btn-secondary text-sm md:text-base px-8 md:px-12 py-3 md:py-4"
            onClick={() => router.push('/login')}
          >
            ВХІД ДЛЯ БІЗНЕСУ
          </Button>
        </div>

        <div className="text-white/60 text-sm space-y-3">
          <p>Вже маєте бізнес? Увійдіть в панель управління</p>
          
          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/test-flow')}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              🧪 Тестовий потік
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/booking/045-barbershop')}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              📅 Приклад бронювання
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/qr/045-barbershop')}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              📱 Приклад QR
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
