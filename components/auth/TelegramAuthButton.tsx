'use client'

import { useEffect, useRef, useState } from 'react'
import { setBusinessData } from '@/lib/business-storage'

const LAST_TELEGRAM_USER_KEY = 'lastTelegramUserName'
const TELEGRAM_ORG_URL = 'https://telegram.org' // тільки для посилання «Вийти в браузері»

interface TelegramAuthButtonProps {
  text?: string
  isRegister?: boolean
  /** Режим відновлення паролю: після підтвердження Telegram редірект на сторінку встановлення нового пароля */
  forgotPasswordMode?: boolean
}

export function TelegramAuthButton({ text, isRegister = false, forgotPasswordMode = false }: TelegramAuthButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const forgotPasswordModeRef = useRef(forgotPasswordMode)
  forgotPasswordModeRef.current = forgotPasswordMode

  const [isLoading, setIsLoading] = useState(false)
  const [lastUserName, setLastUserName] = useState<string | null>(null)
  /** Після першого кліку показуємо панель з інфо про акаунт та кнопкою віджета (щоб нічого не перекривало) */
  const [showPanel, setShowPanel] = useState(false)

  // Читаємо останній Telegram-акаунт з localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLastUserName(localStorage.getItem(LAST_TELEGRAM_USER_KEY))
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return

    const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'xbasesbot'

    // Telegram widget (iframe) іноді кидає SecurityError при зверненні до contentWindow (cross-origin).
    // Ігноруємо цю помилку, щоб вона не ламала сторінку та реєстрацію.
    const onError = (event: ErrorEvent) => {
      if (event.message?.includes('Blocked a frame with origin') || event.message?.includes('SecurityError')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('error', onError)
    const cleanupError = () => window.removeEventListener('error', onError)

    // Глобальна функція для обробки авторизації
    ;(window as any).onTelegramAuth = async (user: any) => {
      try {
        setIsLoading(true)
        console.log('[TelegramAuthButton] OAuth callback:', user)

        if (forgotPasswordModeRef.current) {
          const response = await fetch('/api/auth/forgot-password-telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramData: user }),
          })
          const data = await response.json()
          if (response.ok && data.success && data.resetUrl) {
            window.location.replace(data.resetUrl)
            return
          }
          const errorMsg = data.error || 'Не вдалося відновити пароль через Telegram'
          window.location.replace(`/forgot-password?error=${encodeURIComponent(errorMsg)}`)
          return
        }

        // Отримуємо збережені deviceId та businessId (якщо є)
        const pendingDeviceId = localStorage.getItem('pendingDeviceId')
        const pendingBusinessId = localStorage.getItem('pendingBusinessId')
        
        const response = await fetch('/api/auth/telegram-oauth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            telegramData: user,
            deviceId: pendingDeviceId || undefined,
            businessId: pendingBusinessId || undefined
          })
        })
        
        if (pendingDeviceId) localStorage.removeItem('pendingDeviceId')
        if (pendingBusinessId) localStorage.removeItem('pendingBusinessId')
        
        let data: { success?: boolean; business?: { profileCompleted?: boolean }; action?: string; error?: string }
        try {
          data = await response.json()
        } catch {
          const msg = response.ok ? 'Невірна відповідь від сервера' : `Помилка ${response.status}. Спробуйте ще раз.`
          window.location.replace(`/register?error=${encodeURIComponent(msg)}`)
          return
        }
        
        if (response.ok && data.success) {
          if (data.business) {
            setBusinessData(data.business, true)
            if (!data.business.profileCompleted) {
              localStorage.setItem('showProfileModal', '1')
            }
            console.log('[TelegramAuthButton] Business saved')
          }
          // Зберігаємо ім'я для відображення "Увійти як ІМЯ"
          const displayName = user?.first_name || user?.username || null
          if (displayName) {
            localStorage.setItem(LAST_TELEGRAM_USER_KEY, displayName)
          }
          // Перенаправлення на dashboard
          console.log('[TelegramAuthButton] Redirecting to dashboard...')
          window.location.replace('/dashboard')
        } else {
          console.error('[TelegramAuthButton] Error:', data?.error)
          const errorMsg = data?.error || 'Помилка авторизації через Telegram'
          window.location.replace(`/register?error=${encodeURIComponent(errorMsg)}`)
        }
      } catch (error) {
        console.error('[TelegramAuthButton] Error:', error)
        const errorMsg = error instanceof Error ? error.message : 'Помилка при авторизації через Telegram'
        if (forgotPasswordModeRef.current) {
          window.location.replace(`/forgot-password?error=${encodeURIComponent(errorMsg)}`)
        } else {
          window.location.replace(`/register?error=${encodeURIComponent(errorMsg)}`)
        }
      } finally {
        setIsLoading(false)
      }
    }

    // Очищаємо контейнер
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }

    // Створюємо скрипт для Telegram Login Widget
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botName)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-userpic', 'false')
    script.async = true

    if (containerRef.current) {
      containerRef.current.appendChild(script)
    }

    return () => {
      cleanupError()
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
      if (typeof window !== 'undefined') {
        delete (window as any).onTelegramAuth
      }
    }
  }, [])

  const getButtonText = () => {
    if (text) return text
    if (forgotPasswordMode && lastUserName) return `Відновити пароль як ${lastUserName}`
    if (forgotPasswordMode) return 'Відновити пароль через Telegram'
    if (isRegister && lastUserName) return `Зареєструватися як ${lastUserName}`
    if (isRegister) return 'Зареєструватися через Telegram'
    if (lastUserName) return `Увійти як ${lastUserName}`
    return 'Увійти через Telegram'
  }

  /** Скидаємо вибір акаунту й залишаємо панель відкритою — користувач натискає кнопку Telegram з тим самим підтвердженням (новий акаунт) */
  const handleChangeAccount = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    localStorage.removeItem(LAST_TELEGRAM_USER_KEY)
    setLastUserName(null)
    setShowPanel(true) // панель залишається відкритою, віджет видно — можна одразу обрати інший акаунт
  }

  const handleTogglePanel = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowPanel((v) => !v)
  }

  // Вхід і реєстрація: перший клік показує панель з інфо про акаунт та кнопкою віджета
  return (
    <div className={showPanel ? 'w-full space-y-3 telegram-expanded' : 'w-full space-y-1.5'}>
      <div className="relative min-h-[52px]">
        <div ref={containerRef} className="absolute inset-0 w-full h-full min-h-[52px]" style={{ zIndex: 1 }} />
        {!showPanel && (
          <div
            role="button"
            tabIndex={0}
            onClick={handleTogglePanel}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowPanel(true) } }}
            className="absolute inset-0 w-full h-full min-h-[52px] py-3 rounded-xl bg-white text-gray-700 font-medium flex items-center justify-center gap-3 hover:bg-gray-50 transition-all shadow-md cursor-pointer border border-white/20"
            style={{ zIndex: 2 }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.13-.31-1.09-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" fill="#0088cc" />
            </svg>
            <span>{getButtonText()}</span>
          </div>
        )}
      </div>
      {showPanel && (
        <div className="rounded-xl border border-white/20 bg-white/5 p-3 space-y-3">
          {forgotPasswordMode ? (
            lastUserName ? (
              <p className="text-sm text-gray-300">
                Відновити пароль для <span className="font-medium text-white">{lastUserName}</span>. Натисніть кнопку Telegram вище.
              </p>
            ) : (
              <p className="text-sm text-gray-300">
                Підтвердіть Telegram-акаунт, щоб перейти до встановлення нового пароля. Натисніть кнопку вище або змініть акаунт нижче.
              </p>
            )
          ) : lastUserName ? (
            <p className="text-sm text-gray-300">
              {isRegister ? (
                <>Зареєструватися як <span className="font-medium text-white">{lastUserName}</span>. Натисніть кнопку Telegram вище.</>
              ) : (
                <>Увійти як <span className="font-medium text-white">{lastUserName}</span>. Натисніть кнопку Telegram вище.</>
              )}
            </p>
          ) : (
            <p className="text-sm text-gray-300">
              {isRegister
                ? 'Оберіть акаунт для реєстрації: натисніть кнопку Telegram вище або змініть акаунт нижче.'
                : 'Оберіть акаунт: натисніть кнопку Telegram вище або змініть акаунт нижче.'}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button type="button" onClick={handleChangeAccount} className="text-sm text-gray-400 hover:text-white transition-colors">
              Змінити акаунт
            </button>
            <button type="button" onClick={() => setShowPanel(false)} className="text-sm text-gray-400 hover:text-white transition-colors">
              Згорнути
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Натисніть кнопку Telegram вище щоб увійти з іншим акаунтом. Якщо потрібно вийти з Telegram в браузері —{' '}
            <a href={TELEGRAM_ORG_URL} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white underline">відкрити telegram.org</a>.
          </p>
        </div>
      )}
      <style jsx global>{`
        div[data-telegram-login] {
          opacity: 0 !important;
          pointer-events: auto !important;
        }
        .telegram-expanded div[data-telegram-login] {
          opacity: 1 !important;
        }
        div[data-telegram-login] iframe {
          width: 100% !important;
          height: 52px !important;
          min-height: 52px !important;
          border-radius: 12px !important;
          border: none !important;
          background: transparent !important;
          pointer-events: auto !important;
        }
      `}</style>
    </div>
  )
}
