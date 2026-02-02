'use client'

import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-12 px-4">
      {/* Blurred Background with Barber/Salon Tools */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1920')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
      </div>

      {/* Xbase Logo at top center */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-2">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-candy-sm candy-purple flex items-center justify-center text-white font-black text-xs md:text-sm shadow-soft-lg">
          X
        </div>
        <span className="text-xs md:text-sm font-black text-white">
          Xbase
        </span>
      </div>

      {/* Main Content Card */}
      <div className="relative z-10 w-full max-w-4xl mx-auto">
        <div className="bg-gray-800 dark:bg-gray-900 border border-gray-700 rounded-candy-lg backdrop-blur-sm shadow-soft-xl p-8 md:p-12">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-12 h-12 rounded-candy-sm candy-purple flex items-center justify-center text-white font-black text-xl shadow-soft-lg">
              X
            </div>
            <span className="text-2xl font-black text-white">
              Xbase
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-6xl font-black mb-4 text-candy-blue dark:text-blue-400 text-center">
            СИСТЕМА БРОНЮВАННЯ
          </h1>
          
          {/* Subtitle */}
          <p className="text-base md:text-lg mb-8 text-gray-300 dark:text-gray-400 text-center">
            SaaS платформа для управління записами клієнтів
          </p>
          
          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6 justify-center">
            <button
              onClick={() => router.push('/register')}
              className="w-full sm:w-auto bg-gradient-to-r from-candy-blue to-candy-purple text-white font-bold py-3 px-8 rounded-candy-sm hover:from-candy-blue/90 hover:to-candy-purple/90 transition-all shadow-soft-lg"
            >
              РЕЄСТРАЦІЯ БІЗНЕСУ
            </button>
            <button
              onClick={() => router.push('/login')}
              className="w-full sm:w-auto bg-gray-700 dark:bg-gray-800 border-2 border-gray-600 dark:border-gray-500 text-white px-8 py-3 font-bold hover:bg-gray-600 dark:hover:bg-gray-700 transition-all rounded-candy-sm"
            >
              ВХІД ДЛЯ БІЗНЕСУ
            </button>
          </div>

          {/* Login Prompt */}
          <p className="text-gray-400 dark:text-gray-500 mb-6 text-sm md:text-base text-center">
            Вже маєте бізнес? Увійдіть в панель управління
          </p>
          
          {/* Informational Links */}
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => router.push('/test-flow')}
              className="bg-gray-700 dark:bg-gray-800 border border-gray-600 dark:border-gray-500 text-gray-300 dark:text-gray-300 px-4 py-2 text-xs font-medium hover:bg-gray-600 dark:hover:bg-gray-700 transition-all rounded-candy-xs"
            >
              🧪 Тестовий потік
            </button>
            <button
              onClick={() => router.push('/booking/045-barbershop')}
              className="bg-gray-700 dark:bg-gray-800 border border-gray-600 dark:border-gray-500 text-gray-300 dark:text-gray-300 px-4 py-2 text-xs font-medium hover:bg-gray-600 dark:hover:bg-gray-700 transition-all rounded-candy-xs"
            >
              📅 Приклад бронювання
            </button>
            <button
              onClick={() => router.push('/qr/045-barbershop')}
              className="bg-gray-700 dark:bg-gray-800 border border-gray-600 dark:border-gray-500 text-gray-300 dark:text-gray-300 px-4 py-2 text-xs font-medium hover:bg-gray-600 dark:hover:bg-gray-700 transition-all rounded-candy-xs"
            >
              📱 Приклад QR
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
