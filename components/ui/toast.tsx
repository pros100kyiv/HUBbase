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
    }, toast.duration || 2000)

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
        'min-w-[200px] max-w-sm rounded-candy-sm border-2 p-3 shadow-soft-xl backdrop-blur-md bg-white/90 dark:bg-gray-800/90 transition-all duration-300',
        colors[toast.type || 'info'],
        isVisible ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-full opacity-0 scale-95'
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn(
          'flex-shrink-0 rounded-candy-xs p-1',
          toast.type === 'success' && 'bg-candy-mint/30',
          toast.type === 'error' && 'bg-red-500/30',
          toast.type === 'warning' && 'bg-candy-orange/30',
          toast.type === 'info' && 'bg-candy-blue/30',
        )}>
          {icons[toast.type || 'info']}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-foreground dark:text-white leading-tight">{toast.title}</p>
          {toast.description && (
            <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5 leading-tight">{toast.description}</p>
          )}
        </div>
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
    <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-50 flex flex-col gap-1.5 pointer-events-none">
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

