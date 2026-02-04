'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
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
}

export function GlobalSearch({ businessId, isOpen, onClose }: GlobalSearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults(null)
      return
    }

    const timeoutId = setTimeout(() => {
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(query)}&businessId=${businessId}`)
        .then((res) => res.json())
        .then((data) => {
          setResults(data)
          setLoading(false)
        })
        .catch(() => {
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
    router.push(`/dashboard/services?edit=${id}`)
    onClose()
  }

  const handleMasterClick = (id: string) => {
    router.push(`/dashboard/masters?edit=${id}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        onClick={onClose}
      />
      
      {/* Search Modal */}
      <div className="relative w-full max-w-2xl bg-[#2A2A2A] rounded-xl shadow-2xl border border-white/10">
        {/* Search Input */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Пошук по всьому сервісу..."
              className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none"
              style={{ letterSpacing: '-0.01em' }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Завантаження...</div>
          ) : !query || query.length < 2 ? (
            <div className="p-8 text-center text-gray-400">
              Введіть мінімум 2 символи для пошуку
            </div>
          ) : results && (
            <div className="p-4 space-y-4">
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
                        <div className="text-xs text-gray-400">{service.price} грн</div>
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
                <div className="p-8 text-center text-gray-400">
                  Нічого не знайдено
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

