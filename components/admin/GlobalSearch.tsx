'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ModalPortal } from '@/components/ui/modal-portal'
import { uk } from 'date-fns/locale'

interface SearchResult {
  appointments: Array<{
    id: string
    clientName: string
    clientPhone: string
    startTime: string
    master?: { id: string; name: string }
  }>
  clients: Array<{
    id: string
    name: string
    phone: string
    email?: string | null
  }>
  services: Array<{
    id: string
    name: string
    price: number
  }>
  masters: Array<{
    id: string
    name: string
    bio?: string | null
  }>
}

interface GlobalSearchProps {
  businessId: string
  isOpen: boolean
  onClose: () => void
  /** Елемент-якір: popover з’являється під ним (під кнопкою пошука) */
  anchorRef?: React.RefObject<HTMLElement | null>
}

const POPOVER_WIDTH = 420
const POPOVER_MAX_HEIGHT = 420

export function GlobalSearch({ businessId, isOpen, onClose, anchorRef }: GlobalSearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [anchorPosition, setAnchorPosition] = useState<{ top: number; right: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const updateAnchorPosition = useCallback(() => {
    if (!anchorRef?.current) {
      setAnchorPosition(null)
      return
    }
    const rect = anchorRef.current.getBoundingClientRect()
    const gap = 8
    const top = rect.bottom + gap
    const right = Math.max(8, window.innerWidth - rect.right)
    setAnchorPosition({ top, right })
  }, [anchorRef])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setAnchorPosition(null)
      return
    }
    if (anchorRef?.current) {
      updateAnchorPosition()
      window.addEventListener('resize', updateAnchorPosition)
      window.addEventListener('scroll', updateAnchorPosition, true)
      return () => {
        window.removeEventListener('resize', updateAnchorPosition)
        window.removeEventListener('scroll', updateAnchorPosition, true)
      }
    } else {
      setAnchorPosition(null)
    }
  }, [isOpen, anchorRef, updateAnchorPosition])

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults(null)
      setError(null)
      return
    }

    const timeoutId = setTimeout(() => {
      setLoading(true)
      setError(null)
      fetch(`/api/search?q=${encodeURIComponent(query)}&businessId=${businessId}`)
        .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
        .then(({ ok, data }) => {
          if (!ok || data?.error) {
            setResults(null)
            setError(data?.error || 'Помилка пошуку')
          } else {
            setResults(data)
          }
          setLoading(false)
        })
        .catch(() => {
          setResults(null)
          setError('Помилка з\'єднання')
          setLoading(false)
        })
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, businessId])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleAppointmentClick = (id: string) => {
    router.push(`/dashboard/appointments?edit=${id}`)
    onClose()
  }

  const handleClientClick = (id: string) => {
    router.push(`/dashboard/clients?id=${id}`)
    onClose()
  }

  const handleServiceClick = (id: string) => {
    router.push(`/dashboard/settings?tab=services`)
    onClose()
  }

  const handleMasterClick = (id: string) => {
    router.push(`/dashboard/schedule?edit=${id}`)
    onClose()
  }

  const hasPosition = Boolean(anchorRef && anchorPosition)

  return (
    <ModalPortal>
      {/* Клік поза панеллю закриває (прозорий оверлей) */}
      <div
        className="fixed inset-0 z-[99] min-h-[100dvh]"
        onClick={onClose}
        aria-hidden
      />
      {/* Popover пошуку — під кнопкою або по центру, якщо немає anchor */}
      <div
        role="dialog"
        aria-label="Пошук"
        className="fixed z-[100] rounded-xl border border-white/10 bg-[#1a1a1a] shadow-xl overflow-hidden flex flex-col"
        style={
          hasPosition && anchorPosition
            ? {
                top: anchorPosition.top,
                right: anchorPosition.right,
                left: 'auto',
                width: `min(95vw, ${POPOVER_WIDTH}px)`,
                maxHeight: POPOVER_MAX_HEIGHT,
              }
            : {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: `min(95vw, ${POPOVER_WIDTH}px)`,
                maxHeight: POPOVER_MAX_HEIGHT,
              }
        }
      >
        {/* Поле пошуку */}
        <div className="p-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Пошук..."
              className="flex-1 min-w-0 bg-transparent text-white placeholder-gray-400 outline-none text-sm"
              style={{ letterSpacing: '-0.01em' }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                aria-label="Очистити"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Результати — скрол всередині popover */}
        <div className="overflow-y-auto min-h-0 flex-1">
          {error ? (
            <div className="p-4 text-center text-red-400 text-sm">{error}</div>
          ) : loading ? (
            <div className="p-4 text-center text-gray-400 text-sm">Завантаження...</div>
          ) : !query || query.length < 2 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              Введіть мінімум 2 символи
            </div>
          ) : results && (
            <div className="p-3 space-y-3">
              {/* Appointments */}
              {results.appointments.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2 px-2">Записи</h3>
                  <div className="space-y-1">
                    {results.appointments.map((apt) => (
                      <button
                        key={apt.id}
                        onClick={() => handleAppointmentClick(apt.id)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <div className="text-sm font-medium text-white">{apt.clientName}</div>
                        <div className="text-xs text-gray-400">
                          {format(new Date(apt.startTime), 'd MMMM yyyy, HH:mm', { locale: uk })} • {apt.master?.name || 'Невідомий майстер'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Clients */}
              {results.clients.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2 px-2">Клієнти</h3>
                  <div className="space-y-1">
                    {results.clients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => handleClientClick(client.id)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <div className="text-sm font-medium text-white">{client.name}</div>
                        <div className="text-xs text-gray-400">{client.phone}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Services */}
              {results.services.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2 px-2">Послуги</h3>
                  <div className="space-y-1">
                    {results.services.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => handleServiceClick(service.id)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <div className="text-sm font-medium text-white">{service.name}</div>
                        <div className="text-xs text-gray-400">{Math.round(service.price)} грн</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Masters */}
              {results.masters.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2 px-2">Майстри</h3>
                  <div className="space-y-1">
                    {results.masters.map((master) => (
                      <button
                        key={master.id}
                        onClick={() => handleMasterClick(master.id)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <div className="text-sm font-medium text-white">{master.name}</div>
                        {master.bio && (
                          <div className="text-xs text-gray-400 line-clamp-1">{master.bio}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.appointments.length === 0 &&
               results.clients.length === 0 &&
               results.services.length === 0 &&
               results.masters.length === 0 && (
                <div className="p-4 text-center text-gray-400 text-sm">Нічого не знайдено</div>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  )
}

