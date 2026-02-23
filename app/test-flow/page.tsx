'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestFlowPage() {
  const router = useRouter()
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const testBusiness = {
    email: 'admin@045barbershop.com',
    password: 'password123',
    slug: '045-barbershop',
  }

  const handleQuickLogin = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (isLoggingIn) return
    setLoginError(null)
    setIsLoggingIn(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testBusiness.email,
          password: testBusiness.password,
        }),
      })
      const data = await response.json()
      if (response.ok && data.business) {
        setBusinessData(data.business, true)
        window.location.href = '/dashboard'
      } else {
        setLoginError(data.error || 'Невідома помилка')
        setIsLoggingIn(false)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Невідома помилка'
      setLoginError('Помилка при вході: ' + message)
      setIsLoggingIn(false)
    }
  }

  const handleNavigation = (path: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    window.location.href = path
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4 text-center">
          <button
            onClick={() => window.location.href = '/'}
            className="text-primary hover:underline text-sm"
          >
            ← Головна
          </button>
        </div>
        
        <h1 className="text-4xl font-bold text-title text-primary mb-8 text-center">
          ТЕСТОВИЙ ПОТІК
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Швидкий вхід */}
          <Card className="bg-surface border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary">Швидкий вхід (тестовий акаунт)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p>Email: {testBusiness.email}</p>
                <p>Password: {testBusiness.password}</p>
              </div>
              {loginError && (
                <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{loginError}</p>
              )}
              <Button 
                onClick={handleQuickLogin} 
                className="w-full"
                type="button"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? 'Вхід...' : 'Увійти автоматично'}
              </Button>
            </CardContent>
          </Card>

          {/* Посилання */}
          <Card className="bg-surface border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary">Швидкі посилання</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <button
                onClick={(e) => handleNavigation('/', e)}
                className="w-full h-10 px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/10 transition-all active:scale-95 text-left"
                type="button"
              >
                🏠 Головна
              </button>
              <button
                onClick={(e) => handleNavigation('/register', e)}
                className="w-full h-10 px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/10 transition-all active:scale-95 text-left"
                type="button"
              >
                📝 Реєстрація
              </button>
              <button
                onClick={(e) => handleNavigation('/login', e)}
                className="w-full h-10 px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/10 transition-all active:scale-95 text-left"
                type="button"
              >
                🔐 Вхід
              </button>
              <button
                onClick={(e) => handleNavigation(`/booking/${testBusiness.slug}`, e)}
                className="w-full h-10 px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/10 transition-all active:scale-95 text-left"
                type="button"
              >
                📅 Бронювання (тест)
              </button>
              <button
                onClick={(e) => handleNavigation(`/qr/${testBusiness.slug}`, e)}
                className="w-full h-10 px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/10 transition-all active:scale-95 text-left"
                type="button"
              >
                📱 QR код (тест)
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Покроковий тест */}
        <Card className="bg-surface border-primary/20">
          <CardHeader>
            <CardTitle className="text-primary">Покроковий тест</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-700 dark:text-gray-300">Крок 1: Реєстрація або вхід</h3>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => handleNavigation('/register', e)}
                    className="flex-1 h-10 px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/10 transition-all active:scale-95"
                    type="button"
                  >
                    Реєстрація
                  </button>
                  <button
                    onClick={handleQuickLogin}
                    disabled={isLoggingIn}
                    className="flex-1 h-10 px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/10 disabled:opacity-50 transition-all active:scale-95"
                    type="button"
                  >
                    {isLoggingIn ? 'Вхід...' : 'Вхід в тестовий акаунт'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-secondary">Крок 2: Dashboard</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Після входу ви побачите панель управління з:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1 ml-4">
                  <li>Посиланням для клієнтів</li>
                  <li>QR кодом</li>
                  <li>Налаштуваннями</li>
                  <li>Щоденним журналом записів</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-secondary">Крок 3: Налаштування</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  В налаштуваннях можна:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1 ml-4">
                  <li>Змінити профіль</li>
                  <li>Додати/редагувати майстрів</li>
                  <li>Додати/редагувати послуги</li>
                  <li>Налаштувати кольори</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-secondary">Крок 4: Тестування бронювання</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Відкрийте сторінку бронювання та пройдіть всі кроки:
                </p>
                <button
                  onClick={(e) => handleNavigation(`/booking/${testBusiness.slug}`, e)}
                  className="w-full h-10 px-4 py-2 bg-primary text-background rounded-md hover:bg-primary/90 transition-all active:scale-95"
                  type="button"
                >
                  Відкрити сторінку бронювання
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

