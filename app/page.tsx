'use client'

import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-12 px-4 safe-bottom safe-top">
      {/* Xbase Logo at top center — dashboard base */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-2">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-xs md:text-sm">
          X
        </div>
        <span className="text-xs md:text-sm font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
          Xbase
        </span>
      </div>

      {/* Main Content Card — card-floating, base style */}
      <div className="relative z-10 w-full max-w-4xl mx-auto">
        <div className="rounded-xl p-8 md:p-12 card-floating border border-white/10">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-xl">
              X
            </div>
            <span className="text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
              Xbase
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="text-3xl md:text-5xl font-bold mb-4 text-white text-center" style={{ letterSpacing: '-0.02em' }}>
            СИСТЕМА БРОНЮВАННЯ
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-lg mb-8 text-gray-400 text-center">
            SaaS платформа для управління записами клієнтів
          </p>

          {/* Primary Action Buttons — base: white primary, outline secondary */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6 justify-center">
            <button
              onClick={() => router.push('/register')}
              className="w-full sm:w-auto touch-target min-h-[48px] bg-white text-black font-semibold py-3 px-8 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-all active:scale-[0.98]"
              style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
            >
              РЕЄСТРАЦІЯ БІЗНЕСУ
            </button>
            <button
              onClick={() => router.push('/login')}
              className="w-full sm:w-auto touch-target min-h-[48px] border border-white/20 bg-white/10 text-white font-medium px-8 py-3 rounded-lg hover:bg-white/20 transition-all active:scale-[0.98]"
            >
              ВХІД ДЛЯ БІЗНЕСУ
            </button>
          </div>

          {/* Login Prompt */}
          <p className="text-gray-400 mb-6 text-sm md:text-base text-center">
            Вже маєте бізнес? Увійдіть в панель управління
          </p>

          {/* Informational Links — base secondary buttons */}
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => router.push('/test-flow')}
              className="border border-white/20 bg-white/10 text-white px-4 py-2 text-xs font-medium rounded-lg hover:bg-white/20 transition-all active:scale-[0.98]"
            >
              🧪 Тестовий потік
            </button>
            <button
              onClick={() => router.push('/booking/045-barbershop')}
              className="border border-white/20 bg-white/10 text-white px-4 py-2 text-xs font-medium rounded-lg hover:bg-white/20 transition-all active:scale-[0.98]"
            >
              📅 Приклад бронювання
            </button>
            <button
              onClick={() => router.push('/qr/045-barbershop')}
              className="border border-white/20 bg-white/10 text-white px-4 py-2 text-xs font-medium rounded-lg hover:bg-white/20 transition-all active:scale-[0.98]"
            >
              📱 Приклад QR
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
