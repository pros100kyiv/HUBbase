'use client'

import { useEffect, useRef, useCallback } from 'react'
import { ModalPortal } from '@/components/ui/modal-portal'
import { XIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

export interface ModalProps {
  /** Чи модалка відкрита */
  isOpen: boolean
  /** Callback закриття */
  onClose: () => void
  /** Заголовок */
  title?: React.ReactNode
  /** Підзаголовок */
  subtitle?: React.ReactNode
  /** Контент */
  children: React.ReactNode
  /** Футер з кнопками (опційно) */
  footer?: React.ReactNode
  /** Максимальна ширина */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** Закривати по кліку на оверлей */
  closeOnOverlayClick?: boolean
  /** Закривати по Escape */
  closeOnEscape?: boolean
  /** Вкладені модалки (модалка в модалці) — вищий z-index */
  nested?: boolean
  /** Не показувати кнопку закриття */
  hideCloseButton?: boolean
  /** Додаткові класи для контейнера */
  contentClassName?: string
  /** Прокручуваний контент (default true) */
  scrollable?: boolean
}

const sizeClass = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  full: 'sm:max-w-[min(96vw,52rem)]',
} as const

/**
 * Універсальне модальне вікно з:
 * - Закриттям по Escape
 * - Закриттям по кліку на оверлей
 * - Заголовком, підзаголовком, футером
 * - Варіантами розміру
 * - Підтримкою вкладених модалок
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  nested = false,
  hideCloseButton = false,
  contentClassName,
  scrollable = true,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnOverlayClick && e.target === e.currentTarget) onClose()
    },
    [closeOnOverlayClick, onClose]
  )

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeOnEscape, onClose])

  // Focus first focusable on open
  useEffect(() => {
    if (!isOpen || !contentRef.current) return
    const focusable = contentRef.current.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable) {
      const timer = setTimeout(() => focusable.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!isOpen) return null

  const overlayClasses = cn(
    'modal-overlay sm:!p-4 flex items-center justify-center',
    nested && 'modal-overlay-nested'
  )

  const dialogContent = (
    <div
      className={overlayClasses}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-hidden={!isOpen}
    >
      <div
        ref={contentRef}
        className={cn(
          'relative w-[95%] sm:w-full sm:my-auto modal-content modal-dialog text-white min-h-0 flex flex-col',
          sizeClass[size],
          scrollable ? 'max-h-[85dvh] overflow-y-auto' : 'max-h-[90dvh]',
          contentClassName
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {!hideCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="modal-close touch-target text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[var(--modal-dialog-bg)] rounded-full"
            aria-label="Закрити"
          >
            <XIcon className="w-5 h-5" />
          </button>
        )}
        {(title != null || subtitle != null) && (
          <div className={cn('pr-10', footer ? 'mb-4' : 'mb-4')}>
            {title != null && (
              <h2 id="modal-title" className="modal-title">
                {title}
              </h2>
            )}
            {subtitle != null && (
              <p className="modal-subtitle">{subtitle}</p>
            )}
          </div>
        )}
        <div className={cn('flex-1 min-h-0', scrollable && 'overflow-y-auto')}>
          {children}
        </div>
        {footer && (
          <div className="mt-4 pt-4 border-t border-white/10 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  return <ModalPortal>{dialogContent}</ModalPortal>
}
