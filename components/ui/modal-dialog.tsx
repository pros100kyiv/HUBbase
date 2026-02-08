'use client'

import { XIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

export interface ModalDialogProps {
  /** Заголовок модалки */
  title?: React.ReactNode
  /** Підзаголовок або опис під заголовком */
  subtitle?: React.ReactNode
  /** Обов'язковий callback закриття */
  onClose: () => void
  /** Контент модалки */
  children: React.ReactNode
  /** Додаткові класи для контейнера діалогу */
  className?: string
  /** Максимальна ширина: sm (28rem), md (32rem), lg (36rem), xl (42rem) */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
  /** Клік по оверлею закриває модалку */
  closeOnOverlayClick?: boolean
  /** Не рендерити заголовок/кнопку закриття — тільки обгортка для контенту */
  bare?: boolean
}

const maxWidthClass = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
} as const

/**
 * Обгортка для контенту модального вікна з єдиним стилем:
 * оверлей, контейнер, діалог, кнопка закриття, опційно заголовок/підзаголовок.
 * Використовуй разом з ModalPortal:
 *
 * <ModalPortal>
 *   <ModalDialog title="..." onClose={...} subtitle="...">
 *     {content}
 *   </ModalDialog>
 * </ModalPortal>
 */
export function ModalDialog({
  title,
  subtitle,
  onClose,
  children,
  className,
  maxWidth = 'md',
  closeOnOverlayClick = true,
  bare = false,
}: ModalDialogProps) {
  return (
    <div
      className="modal-overlay sm:!p-4"
      onClick={closeOnOverlayClick ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        className={cn(
          'relative w-[95%] sm:w-full sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] min-h-0',
          maxWidthClass[maxWidth],
          !bare && 'flex flex-col',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {!bare && (
          <>
            <button
              type="button"
              onClick={onClose}
              className="modal-close text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[var(--modal-dialog-bg)] rounded-full"
              aria-label="Закрити"
            >
              <XIcon className="w-5 h-5" />
            </button>
            {(title != null || subtitle != null) && (
              <div className="pr-10 mb-4">
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
          </>
        )}
        {children}
      </div>
    </div>
  )
}
