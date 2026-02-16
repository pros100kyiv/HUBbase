'use client'

import { useEffect, useState } from 'react'
import { useBooking, Master } from '@/contexts/BookingContext'
import { cn } from '@/lib/utils'

interface MasterStepProps {
  businessId?: string
}

// Функція для визначення статі за ім'ям (українські імена)
const getGenderFromName = (name: string): 'male' | 'female' => {
  const femaleEndings = ['а', 'я', 'ія', 'іна', 'ка', 'на', 'ла', 'ра', 'са', 'та', 'ва', 'ша', 'ща']
  const nameLower = name.toLowerCase().trim()
  const lastChar = nameLower[nameLower.length - 1]
  
  // Перевірка на жіночі закінчення
  if (femaleEndings.some(ending => nameLower.endsWith(ending))) {
    return 'female'
  }
  
  // За замовчуванням чоловік
  return 'male'
}

// Компонент аватара
const AvatarIcon = ({ gender, size = 64 }: { gender: 'male' | 'female', size?: number }) => {
  if (gender === 'female') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="20" r="12" fill="#A78BFA" />
        <path d="M16 52 C16 42, 24 36, 32 36 C40 36, 48 42, 48 52" stroke="#A78BFA" strokeWidth="4" fill="none" />
        <path d="M20 24 Q24 20, 28 24" stroke="#8B5CF6" strokeWidth="2" fill="none" />
        <path d="M36 24 Q40 20, 44 24" stroke="#8B5CF6" strokeWidth="2" fill="none" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="18" r="12" fill="#A78BFA" />
      <path d="M16 52 C16 42, 24 36, 32 36 C40 36, 48 42, 48 52" stroke="#A78BFA" strokeWidth="4" fill="none" />
      <rect x="26" y="22" width="12" height="4" rx="2" fill="#8B5CF6" />
    </svg>
  )
}

export function MasterStep({ businessId }: MasterStepProps) {
  const { state, setMaster, setStep } = useBooking()
  const [masters, setMasters] = useState<Master[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!businessId) return
    const cacheKey = `booking:masters:${businessId}`
    const now = Date.now()

    // Fast path: show cached list immediately (improves perceived performance on mobile).
    try {
      const raw = sessionStorage.getItem(cacheKey)
      if (raw) {
        const parsed = JSON.parse(raw) as { t: number; data: Master[] }
        if (parsed && Array.isArray(parsed.data) && typeof parsed.t === 'number' && now - parsed.t < 5 * 60_000) {
          const active = parsed.data.filter((m) => (m as any)?.isActive !== false)
          setMasters(active)
        }
      }
    } catch {
      // ignore cache
    }

    const ac = new AbortController()
    setLoading(true)
    setLoadError(null)

    // Use lightweight API response: no weekly schedule / overrides payload.
    fetch(`/api/masters?businessId=${encodeURIComponent(businessId)}&light=1`, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to fetch'))
        return res.json()
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        const activeMasters = list.filter((master: Master) => master.isActive !== false)
        setMasters(activeMasters)
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), data: list }))
        } catch {
          // ignore cache write errors
        }
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return
        setMasters([])
        setLoadError('Не вдалося завантажити список спеціалістів. Спробуйте ще раз.')
      })
      .finally(() => setLoading(false))

    return () => ac.abort()
  }, [businessId])

  const isAvailableToday = (masterId: string) => {
    // This would check actual availability - simplified for now
    return true
  }

  return (
    <div className="min-h-screen py-4 sm:py-6 px-3 md:px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 text-center text-foreground" style={{ letterSpacing: '-0.02em' }}>
          Оберіть спеціаліста
        </h2>

        {loadError && (
          <div className="rounded-xl p-4 mb-4 border border-rose-500/20 bg-rose-500/10 text-rose-800 dark:text-rose-200">
            <p className="text-sm font-semibold">{loadError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4">
          {loading && masters.length === 0 ? (
            Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="rounded-xl p-3 sm:p-4 card-glass border border-black/10 dark:border-white/10 animate-pulse">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-black/[0.06] dark:bg-white/10 mb-3" />
                  <div className="h-4 w-32 bg-black/[0.06] dark:bg-white/10 rounded mb-2" />
                  <div className="h-3 w-44 bg-black/[0.05] dark:bg-white/10 rounded mb-3" />
                  <div className="h-3 w-24 bg-black/[0.05] dark:bg-white/10 rounded" />
                </div>
              </div>
            ))
          ) : masters.length === 0 ? (
            <div className="sm:col-span-2 rounded-xl p-6 card-glass border border-black/10 dark:border-white/10 text-center">
              <p className="text-sm font-semibold text-foreground">Немає активних спеціалістів</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Додайте спеціаліста в кабінеті або увімкніть його активність.
              </p>
            </div>
          ) : (
            masters.map((master) => {
              const available = isAvailableToday(master.id)
              const gender = getGenderFromName(master.name)
              return (
                <div
                  key={master.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setMaster(master)}
                  onKeyDown={(e) => e.key === 'Enter' && setMaster(master)}
                  className={cn(
                    'rounded-xl p-3 sm:p-4 card-glass cursor-pointer transition-all hover:bg-black/[0.03] dark:hover:bg-white/[0.08] active:scale-[0.99] min-h-[44px] touch-target',
                    state.selectedMaster?.id === master.id && 'ring-2 ring-black/20 dark:ring-white/50 bg-black/[0.04] dark:bg-white/[0.12]'
                  )}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-2 sm:mb-3">
                      <div
                        className={cn(
                          'w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full border-2 flex items-center justify-center bg-black/[0.04] dark:bg-white/10 overflow-hidden flex-shrink-0',
                          available ? 'border-black/20 dark:border-white/30' : 'border-black/10 dark:border-white/10'
                        )}
                      >
                        {master.photo ? (
                          <img
                            src={master.photo}
                            alt={master.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="flex items-center justify-center">
                            <AvatarIcon gender={gender} size={64} />
                          </div>
                        )}
                      </div>
                      <div className={cn('absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-[#2A2A2A]', available ? 'bg-green-500' : 'bg-gray-500')} />
                    </div>
                    <h3 className="text-base font-semibold mb-1 text-foreground">{master.name}</h3>
                    {master.bio && <p className="text-xs mb-2 line-clamp-2 text-gray-600 dark:text-gray-400">{master.bio}</p>}
                    <div className="flex items-center gap-1 mb-2">
                      <span className="text-foreground/80 dark:text-white/80">★</span>
                      <span className="text-xs text-gray-700 dark:text-gray-300">{master.rating?.toFixed(1) ?? '-'}</span>
                    </div>
                    <p className={cn('text-xs', available ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-500')}>{available ? 'Доступний' : 'Недоступний'}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => setStep(0)} className="touch-target flex-1 min-h-[48px] py-2.5 rounded-lg border border-black/10 dark:border-white/20 bg-black/[0.04] dark:bg-white/10 text-foreground dark:text-white text-sm font-medium hover:bg-black/[0.06] dark:hover:bg-white/20 transition-colors active:scale-[0.98]">
            Назад
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!state.selectedMaster}
            className="flex-1 touch-target min-h-[48px] py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.25)' }}
          >
            Далі
          </button>
        </div>
      </div>
    </div>
  )
}

