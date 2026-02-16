'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { CheckIcon, XIcon, AlertCircleIcon, InfoIcon } from '@/components/icons'

export interface Toast {
  id: string
  title: string
  description?: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

interface ToastProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastComponent({ toast, onRemove }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => onRemove(toast.id), 300)
    }, toast.duration || 3000)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onRemove])

  const icons = {
    success: <CheckIcon className="w-5 h-5" />,
    error: <XIcon className="w-5 h-5" />,
    warning: <AlertCircleIcon className="w-5 h-5" />,
    info: <InfoIcon className="w-5 h-5" />,
  }

  const colors = {
    success: 'bg-candy-mint/10 border-candy-mint text-candy-mint',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-600 dark:text-red-400',
    warning: 'bg-candy-orange/10 border-candy-orange text-candy-orange',
    info: 'bg-candy-blue/10 border-candy-blue text-candy-blue',
  }

  return (
    <div
      className={cn(
        // Mobile: allow full width (container clamps to viewport).
        // Desktop: keep the original min/max widths.
        'w-full sm:min-w-[300px] sm:max-w-md rounded-candy-sm border-2 p-4 shadow-soft-lg backdrop-blur-sm transition-all duration-300',
        colors[toast.type || 'info'],
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex-shrink-0 rounded-candy-sm p-1.5',
          toast.type === 'success' && 'bg-candy-mint/20',
          toast.type === 'error' && 'bg-red-500/20',
          toast.type === 'warning' && 'bg-candy-orange/20',
          toast.type === 'info' && 'bg-candy-blue/20',
        )}>
          {icons[toast.type || 'info']}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-black', toast.type === 'success' ? 'text-candy-mint' : 'text-foreground dark:text-white')}>{toast.title}</p>
          {toast.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{toast.description}</p>
          )}
        </div>
        <button
          onClick={() => {
            setIsVisible(false)
            setTimeout(() => onRemove(toast.id), 300)
          }}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const handleToast = (event: Event) => {
      const customEvent = event as CustomEvent<Toast>
      const newToast = {
        ...customEvent.detail,
        id: customEvent.detail.id || Math.random().toString(36).substr(2, 9),
      }
      setToasts((prev) => [...prev, newToast])
    }

    window.addEventListener('toast', handleToast)
    return () => window.removeEventListener('toast', handleToast)
  }, [])

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div
      className={cn(
        // Mobile: center under top bar; Desktop: top-right.
        'fixed z-50 flex flex-col gap-2 pointer-events-none',
        'left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-4',
        // Under the fixed navbar/panels on small screens.
        'top-[calc(env(safe-area-inset-top,0px)+4rem)] sm:top-4',
        // Clamp width to viewport on mobile.
        'w-[min(92vw,420px)] sm:w-auto'
      )}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastComponent toast={toast} onRemove={removeToast} />
        </div>
      ))}
    </div>
  )
}

export function toast(toastData: Omit<Toast, 'id'>) {
  const event = new CustomEvent('toast', {
    detail: { ...toastData, id: Math.random().toString(36).substr(2, 9) },
  })
  window.dispatchEvent(event)
}

