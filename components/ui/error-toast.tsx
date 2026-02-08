'use client'

import { useEffect, useState } from 'react'

interface ErrorToastProps {
  message: string
  onClose: () => void
  needsRegistration?: boolean
  onRegister?: () => void
}

export function ErrorToast({ message, onClose, needsRegistration, onRegister }: ErrorToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300) // Чекаємо завершення анімації
    }, 5000) // Автоматично закривається через 5 секунд

    return () => clearTimeout(timer)
  }, [onClose])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  if (!isVisible) return null

  return (
    <div className="fixed z-50 left-[max(0.5rem,env(safe-area-inset-left))] right-[max(0.5rem,env(safe-area-inset-right))] top-[max(0.5rem,env(safe-area-inset-top))] sm:left-auto sm:right-4 sm:top-4 sm:w-auto w-[calc(100%-max(1rem,env(safe-area-inset-left))-max(1rem,env(safe-area-inset-right)))] max-w-[400px] animate-in slide-in-from-top-5">
      <div className="bg-red-500/90 backdrop-blur-sm border border-red-400 rounded-xl shadow-lg p-4 min-w-0">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium break-words">{message}</p>
            {needsRegistration && onRegister && (
              <button
                type="button"
                onClick={() => {
                  handleClose()
                  onRegister()
                }}
                className="touch-target mt-2 min-h-[44px] text-white text-sm font-medium underline hover:no-underline"
              >
                Зареєструватися
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="touch-target flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-white/80 hover:text-white transition-colors rounded-lg"
            aria-label="Закрити"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

