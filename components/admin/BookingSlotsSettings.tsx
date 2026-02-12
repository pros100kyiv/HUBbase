'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'

export type BookingSlotsConfig = {
  slotStepMinutes?: 15 | 30 | 60
  bufferMinutes?: number
  minAdvanceBookingMinutes?: number
  maxDaysAhead?: number
}

const DEFAULT_CONFIG: Required<BookingSlotsConfig> = {
  slotStepMinutes: 30,
  bufferMinutes: 0,
  minAdvanceBookingMinutes: 60,
  maxDaysAhead: 60,
}

const SLOT_STEP_OPTIONS = [
  { value: 15, label: '15 хв' },
  { value: 30, label: '30 хв' },
  { value: 60, label: '60 хв' },
] as const

const BUFFER_OPTIONS = [
  { value: 0, label: 'Без паузи' },
  { value: 5, label: '5 хв' },
  { value: 10, label: '10 хв' },
  { value: 15, label: '15 хв' },
  { value: 20, label: '20 хв' },
  { value: 30, label: '30 хв' },
]

const MIN_ADVANCE_OPTIONS = [
  { value: 0, label: 'Будь-коли' },
  { value: 60, label: 'За 1 год' },
  { value: 120, label: 'За 2 год' },
  { value: 360, label: 'За 6 год' },
  { value: 1440, label: 'За 24 год' },
]

const MAX_DAYS_OPTIONS = [
  { value: 7, label: '7 днів' },
  { value: 14, label: '14 днів' },
  { value: 30, label: '30 днів' },
  { value: 60, label: '60 днів' },
  { value: 90, label: '90 днів' },
]

export function BookingSlotsSettings({
  businessId,
  currentSettings,
  onSave,
}: {
  businessId: string
  currentSettings?: string | null
  onSave?: (config: BookingSlotsConfig) => void
}) {
  const [config, setConfig] = useState<Required<BookingSlotsConfig>>(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentSettings) {
      try {
        const parsed = JSON.parse(currentSettings) as Record<string, unknown>
        const booking = parsed.bookingSlots as Partial<BookingSlotsConfig> | undefined
        if (booking) {
          setConfig({
            slotStepMinutes: [15, 30, 60].includes(Number(booking.slotStepMinutes))
              ? (booking.slotStepMinutes as 15 | 30 | 60)
              : DEFAULT_CONFIG.slotStepMinutes,
            bufferMinutes: typeof booking.bufferMinutes === 'number'
              ? Math.max(0, Math.min(30, Math.round(booking.bufferMinutes)))
              : DEFAULT_CONFIG.bufferMinutes,
            minAdvanceBookingMinutes: typeof booking.minAdvanceBookingMinutes === 'number'
              ? Math.max(0, Math.min(10080, Math.round(booking.minAdvanceBookingMinutes)))
              : DEFAULT_CONFIG.minAdvanceBookingMinutes,
            maxDaysAhead: typeof booking.maxDaysAhead === 'number'
              ? Math.max(1, Math.min(365, Math.round(booking.maxDaysAhead)))
              : DEFAULT_CONFIG.maxDaysAhead,
          })
        }
      } catch {
        // ignore
      }
    }
  }, [currentSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/business/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingSlots: {
            slotStepMinutes: config.slotStepMinutes,
            bufferMinutes: config.bufferMinutes,
            minAdvanceBookingMinutes: config.minAdvanceBookingMinutes,
            maxDaysAhead: config.maxDaysAhead,
          },
        }),
      })
      if (res.ok) {
        onSave?.(config)
        toast({ title: 'Налаштування збережено', type: 'success', duration: 1500 })
      } else {
        const err = await res.json().catch(() => ({}))
        toast({ title: 'Помилка', description: err.error || 'Не вдалося зберегти', type: 'error' })
      }
    } catch {
      toast({ title: 'Помилка', description: 'Не вдалося зберегти налаштування', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl p-4 md:p-6 card-glass">
      <h2 className="text-lg font-bold text-white mb-4" style={{ letterSpacing: '-0.02em' }}>
        Налаштування слотів записів
      </h2>
      <p className="text-sm text-gray-400 mb-6">
        Гнучкі параметри для вільного часу, бронювання та записів клієнтів.
      </p>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Крок слоту</label>
          <p className="text-xs text-gray-500 mb-2">Інтервал між можливими годинами запису</p>
          <div className="flex flex-wrap gap-2">
            {SLOT_STEP_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setConfig((p) => ({ ...p, slotStepMinutes: opt.value }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  config.slotStepMinutes === opt.value
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-white border border-white/20 hover:bg-white/15'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Пауза між записами</label>
          <p className="text-xs text-gray-500 mb-2">Час на прибирання, підготовку між клієнтами</p>
          <select
            value={config.bufferMinutes}
            onChange={(e) =>
              setConfig((p) => ({ ...p, bufferMinutes: Number(e.target.value) }))
            }
            className="w-full max-w-xs px-3 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:ring-2 focus:ring-white/30 focus:border-white/30"
          >
            {BUFFER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Мін. час до запису
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Слоти раніше цього часу не показуватимуться (не можна записатися «відразу»)
          </p>
          <select
            value={config.minAdvanceBookingMinutes}
            onChange={(e) =>
              setConfig((p) => ({ ...p, minAdvanceBookingMinutes: Number(e.target.value) }))
            }
            className="w-full max-w-xs px-3 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:ring-2 focus:ring-white/30 focus:border-white/30"
          >
            {MIN_ADVANCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Макс. днів вперед
          </label>
          <p className="text-xs text-gray-500 mb-2">До якої дати клієнти можуть записуватися</p>
          <select
            value={config.maxDaysAhead}
            onChange={(e) =>
              setConfig((p) => ({ ...p, maxDaysAhead: Number(e.target.value) }))
            }
            className="w-full max-w-xs px-3 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:ring-2 focus:ring-white/30 focus:border-white/30"
          >
            {MAX_DAYS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100"
        style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
      >
        {saving ? 'Збереження...' : 'Зберегти налаштування'}
      </Button>
    </div>
  )
}
