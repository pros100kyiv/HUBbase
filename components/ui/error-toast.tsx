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
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
      <div className="bg-red-500/90 backdrop-blur-sm border border-red-400 rounded-lg shadow-lg p-4 min-w-[300px] max-w-[400px]">
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
          <div className="flex-1">
            <p className="text-white text-sm font-medium">{message}</p>
            {needsRegistration && onRegister && (
              <button
                onClick={() => {
                  handleClose()
                  onRegister()
                }}
                className="mt-2 text-white text-xs underline hover:no-underline"
              >
                Зареєструватися
              </button>
            )}
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
          >
            <svg
              className="w-4 h-4"
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

