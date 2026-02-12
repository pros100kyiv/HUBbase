'use client'

import React, { useEffect, useState } from 'react'
import { format, isValid } from 'date-fns'
import { uk } from 'date-fns/locale'
import { ModalPortal } from '@/components/ui/modal-portal'

/** Нормалізує час до HH:mm (двозначні години і хвилини) для коректного відображення і передачі в запис. */
function normalizeTimeHHmm(t: string): string {
  const match = t.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return t
  const h = Math.max(0, Math.min(23, parseInt(match[1], 10) || 0))
  const m = Math.max(0, Math.min(59, parseInt(match[2], 10) || 0))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export interface FreeSlotsModalProps {
  isOpen: boolean
  onClose: () => void
  businessId: string | undefined
  /** Дата, для якої показувати вільні слоти */
  date: Date
  onBookSlot: (date: Date, time: string, masterId?: string) => void
}

export function FreeSlotsModal({
  isOpen,
  onClose,
  businessId,
  date,
  onBookSlot,
}: FreeSlotsModalProps) {
  const [mastersList, setMastersList] = useState<Array<{ id: string; name: string }>>([])
  const [mastersLoading, setMastersLoading] = useState(false)
  const [selectedMasterId, setSelectedMasterId] = useState<string>('')
  const [freeSlots, setFreeSlots] = useState<string[]>([])
  const [freeSlotsLoading, setFreeSlotsLoading] = useState(false)
  const [freeSlotsError, setFreeSlotsError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !businessId) return
    setMastersList([])
    setSelectedMasterId('')
    setFreeSlots([])
    setFreeSlotsError(null)
    setMastersLoading(true)
    fetch(`/api/masters?businessId=${encodeURIComponent(businessId)}`)
      .then((res) => (res.ok ? res.json() : Promise.resolve([])))
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setMastersList(list)
      })
      .catch(() => setMastersList([]))
      .finally(() => setMastersLoading(false))
  }, [isOpen, businessId])

  useEffect(() => {
    if (mastersList.length > 0 && !selectedMasterId) setSelectedMasterId(mastersList[0].id)
  }, [mastersList, selectedMasterId])

  const dateStr = isValid(date) ? format(date, 'yyyy-MM-dd') : ''
  useEffect(() => {
    if (!isOpen || !businessId || !dateStr || !selectedMasterId) {
      if (isOpen && businessId && !selectedMasterId) {
        setFreeSlots([])
        setFreeSlotsLoading(false)
        setFreeSlotsError(null)
      }
      return
    }
    const masterId = selectedMasterId
    setFreeSlotsLoading(true)
    setFreeSlotsError(null)
    const params = new URLSearchParams({
      businessId,
      masterId,
      date: dateStr,
      durationMinutes: '30',
    })
    fetch(`/api/availability?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { availableSlots: [] }))
      .then((data) => {
        const raw: unknown[] = Array.isArray(data?.availableSlots) ? data.availableSlots : []
        const times = raw
          .filter((s: unknown): s is string => typeof s === 'string')
          .map((s: string) => {
            const t = s.includes('T') ? s.slice(11, 16) : s
            return normalizeTimeHHmm(t)
          })
          .filter((t): t is string => Boolean(t))
        setFreeSlots(times)
        setFreeSlotsError(
          data?.scheduleNotConfigured ? 'Графік не налаштовано' : data?.reason === 'day_off' ? 'Вихідний' : null
        )
      })
      .catch(() => {
        setFreeSlots([])
        setFreeSlotsError('Помилка завантаження')
      })
      .finally(() => setFreeSlotsLoading(false))
  }, [isOpen, businessId, dateStr, selectedMasterId])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isLoading = mastersLoading || (mastersList.length > 0 && !selectedMasterId) || (selectedMasterId && freeSlotsLoading)
  const selectedMaster = mastersList.find((m) => m.id === selectedMasterId)

  return (
    <ModalPortal>
      <div className="modal-overlay sm:!p-4" onClick={onClose}>
        <div
          className="relative w-[95%] sm:w-full sm:max-w-md sm:my-auto modal-content modal-dialog text-white max-h-[90dvh] flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="modal-close text-gray-400 hover:text-white"
            aria-label="Закрити"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="pr-10 mb-2 flex-shrink-0 pb-4 border-b border-white/10 border-l-4 border-l-sky-500/40">
            <h2 className="modal-title">Вільні години</h2>
            <p className="modal-subtitle">
              {isValid(date) ? format(date, 'd MMMM yyyy', { locale: uk }) : '—'}
            </p>
          </div>

          {mastersList.length > 1 && !mastersLoading && (
            <div className="flex-shrink-0 px-1 pt-2 pb-1">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Спеціаліст</label>
              <select
                value={selectedMasterId}
                onChange={(e) => {
                  setSelectedMasterId(e.target.value)
                  setFreeSlotsError(null)
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-white/15 bg-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50"
              >
                {mastersList.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#1a1a1a] text-white">
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mastersList.length === 1 && selectedMaster && !mastersLoading && (
            <div className="flex-shrink-0 px-1 pt-1 pb-0">
              <p className="text-xs text-gray-500">Спеціаліст: {selectedMaster.name}</p>
            </div>
          )}

          <div className="flex-1 min-h-[220px] overflow-y-auto scrollbar-hide py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 min-h-[180px]">
                <div className="w-10 h-10 border-2 border-sky-500/40 border-t-sky-400 rounded-full animate-spin mb-4" />
                <p className="text-sm">Завантаження...</p>
              </div>
            ) : mastersList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-300 mb-1">Немає спеціалістів</p>
                <p className="text-xs text-gray-500">Додайте спеціалістів і налаштуйте графік у налаштуваннях</p>
              </div>
            ) : freeSlotsError ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-300 mb-1">{freeSlotsError}</p>
                <p className="text-xs text-gray-500 mb-4">
                  {mastersList.length > 1
                    ? 'Оберіть іншого спеціаліста вище або змініть дату'
                    : 'Змініть дату або налаштуйте графік роботи'}
                </p>
                {mastersList.length > 1 && (
                  <select
                    value={selectedMasterId}
                    onChange={(e) => {
                      setSelectedMasterId(e.target.value)
                      setFreeSlotsError(null)
                    }}
                    className="px-3 py-2 rounded-lg border border-white/20 bg-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  >
                    {mastersList.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#1a1a1a]">
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : freeSlots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-300 mb-1">Вільних слотів немає</p>
                <p className="text-xs text-gray-500">Усі години зайняті або день не робочий</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {freeSlots.map((time) => (
                  <div
                    key={time}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl bg-white/5 border border-white/10 p-3 hover:bg-white/10 transition-colors"
                  >
                    <span className="text-sm font-semibold tabular-nums text-white">{time}</span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onBookSlot(date, normalizeTimeHHmm(time), selectedMasterId || undefined)
                      }}
                      className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-400 text-sm font-medium hover:bg-sky-500/30 transition-colors active:scale-[0.98]"
                    >
                      Записатися
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
