'use client'

import { useEffect, useState } from 'react'
import { useBooking } from '@/contexts/BookingContext'
import { InstallAppBadges } from '@/components/layout/InstallAppBadges'
import { cn } from '@/lib/utils'
import { XbaseLogo } from '@/components/layout/XbaseLogo'

interface Business {
  id?: string
  name?: string
  slug?: string
  description?: string | null
  logo?: string | null
  avatar?: string | null
  businessCardBackgroundImage?: string | null
  slogan?: string | null
  additionalInfo?: string | null
  socialMedia?: string | null
  location?: string | null
}

interface LandingStepProps {
  business?: Business | null
}

const TelegramIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.192l-1.87 8.803c-.14.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.053 5.56-5.022c.24-.213-.054-.334-.373-.12l-6.87 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
  </svg>
)

export function LandingStep({ business }: LandingStepProps) {
  const { setStep } = useBooking()
  const [tgInviteLink, setTgInviteLink] = useState<string | null>(null)

  useEffect(() => {
    const slug = business?.slug
    const bid = business?.id
    if (!slug && !bid) return
    fetch(`/api/booking/telegram-invite?${slug ? `slug=${encodeURIComponent(slug)}` : `businessId=${encodeURIComponent(bid!)}`}`)
      .then((r) => r.json())
      .then((d) => (d?.hasTelegram && d?.inviteLink ? setTgInviteLink(d.inviteLink) : null))
      .catch(() => {})
  }, [business?.slug, business?.id])
  const logoSrc = business?.logo || business?.avatar || null
  const headline = (business?.slogan?.trim() || business?.description?.trim() || '').trim()
  const subText = (business?.additionalInfo?.trim() || '').trim()
  const location = (business?.location?.trim() || '').trim()

  const socials = (() => {
    const raw = business?.socialMedia
    if (!raw) return null as null | Record<string, string>
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const out: Record<string, string> = {}
        for (const k of ['instagram', 'facebook', 'telegram', 'tiktok', 'website']) {
          const v = (parsed as any)[k]
          if (typeof v === 'string' && v.trim()) out[k] = v.trim()
        }
        return Object.keys(out).length ? out : null
      }
    } catch {
      // not json
    }
    // fallback: show as plain text
    return { links: raw } as any
  })()

  const normalizeUrl = (val: string): string => {
    const v = val.trim()
    if (!v) return v
    if (/^https?:\/\//i.test(v)) return v
    if (v.startsWith('@')) return `https://instagram.com/${v.slice(1)}`
    if (/^[a-z0-9_.]+$/i.test(v) && v.length >= 2) return `https://instagram.com/${v}`
    return v
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-12 px-4 pb-24 md:pb-12">
      {/* Background */}
      {business?.businessCardBackgroundImage ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${business.businessCardBackgroundImage})` }}
          aria-hidden
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0f172a] to-black" aria-hidden />
      )}
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[1px]" aria-hidden />

      <div className="relative z-10 w-full max-w-3xl mx-auto px-2 sm:px-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/30 overflow-hidden">
          <div className="p-5 sm:p-7 text-center">
            <div className="flex items-center justify-center mb-4">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoSrc}
                  alt={business?.name || 'Логотип'}
                  className="w-14 h-14 rounded-2xl object-cover border border-white/15 bg-white/10"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white font-bold">
                  {(business?.name || 'B').slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl md:text-4xl font-bold mb-2 text-white" style={{ letterSpacing: '-0.02em' }}>
              {business?.name || 'Бізнес'}
            </h1>

            {headline ? (
              <p className="text-sm md:text-base mb-4 max-w-2xl mx-auto text-gray-200">
                {headline}
              </p>
            ) : (
              <p className="text-sm md:text-base mb-4 max-w-2xl mx-auto text-gray-300">
                Професійні послуги високої якості
              </p>
            )}

            {subText && (
              <p className="text-xs sm:text-sm text-gray-300 max-w-2xl mx-auto mb-4 whitespace-pre-line">
                {subText}
              </p>
            )}

            {(location || socials) && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-5">
                {location && (
                  <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-200 max-w-full truncate">
                    {location}
                  </div>
                )}
                {socials && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {Object.entries(socials).slice(0, 4).map(([k, v]) => (
                      <a
                        key={k}
                        href={normalizeUrl(String(v))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'px-3 py-2 rounded-xl text-xs font-medium border transition-colors',
                          'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 hover:border-white/20'
                        )}
                      >
                        {k === 'links' ? 'Соцмережі' : k}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="hidden md:flex flex-col sm:flex-row items-center justify-center gap-2 md:gap-3">
              <button
                type="button"
                className="px-6 md:px-8 py-3 md:py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors active:scale-[0.98] text-sm md:text-base inline-flex items-center gap-2"
                style={{ boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.35)' }}
                onClick={() => setStep(1)}
              >
                Запис онлайн
              </button>
              {tgInviteLink && (
                <a
                  href={tgInviteLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 md:px-8 py-3 md:py-4 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white font-semibold transition-colors active:scale-[0.98] text-sm md:text-base inline-flex items-center gap-2 border border-[#0088cc]/50"
                  style={{ boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.25)' }}
                >
                  <TelegramIcon />
                  Запис у Telegram
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 md:hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 space-y-2">
        <div className="flex justify-center">
          <InstallAppBadges variant="compact" />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 min-h-[48px] py-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors active:scale-[0.98] text-sm touch-target"
            style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.25)' }}
            onClick={() => setStep(1)}
          >
            Запис онлайн
          </button>
          {tgInviteLink && (
            <a
              href={tgInviteLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-h-[48px] py-4 rounded-lg bg-[#0088cc] hover:bg-[#0077b5] text-white font-semibold transition-colors active:scale-[0.98] text-sm touch-target inline-flex items-center justify-center gap-1.5"
              style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.25)' }}
            >
              <TelegramIcon />
              Telegram
            </a>
          )}
        </div>
      </div>

      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-20 flex items-center">
        <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm">
          <XbaseLogo size="sm" variant="light" />
        </div>
      </div>

      <div className="fixed top-4 left-4 z-20">
        <button
          type="button"
          className="px-3 py-2 rounded-lg border border-white/20 bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
          onClick={() => window.location.href = '/'}
        >
          ← Головна
        </button>
      </div>
    </div>
  )
}

