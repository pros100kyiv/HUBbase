'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

const QRCodeSVG = dynamic(
  () => import('qrcode.react').then((m) => ({ default: m.QRCodeSVG })),
  { ssr: false }
)
import { toast } from '@/components/ui/toast'
import { InstallAppBadges } from '@/components/layout/InstallAppBadges'

export default function QRPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const [bookingUrl, setBookingUrl] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (slug) {
      setBookingUrl(`${window.location.origin}/booking/${slug}`)
    }
  }, [slug])

  if (!slug) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <p className="text-gray-400">Slug не знайдено</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full rounded-2xl p-8 bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl">
        <h1 className="text-3xl font-bold text-center mb-6 text-white/95" style={{ letterSpacing: '-0.02em' }}>
          QR КОД ДЛЯ БРОНЮВАННЯ
        </h1>
        <div className="flex justify-center mb-6">
          <div className={`relative ${mounted && bookingUrl ? 'animate-content-fade-in' : ''}`}>
            {mounted && bookingUrl ? (
              <QRCodeSVG
                value={bookingUrl}
                size={256}
                level="H"
                includeMargin={true}
              />
            ) : (
              <div className="w-64 h-64 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <p className="text-gray-400 text-sm">Завантаження...</p>
              </div>
            )}
          </div>
        </div>
        <p className="text-center text-gray-400 text-sm mb-4">
          Відскануйте QR код для швидкого доступу до бронювання
        </p>
        <div className="flex justify-center mb-4">
          <InstallAppBadges variant="full" />
        </div>
        {mounted && bookingUrl && (
          <div className="rounded-xl p-4 text-center mb-4 space-y-2 animate-content-fade-in bg-white/5 border border-white/10">
            <p className="text-xs text-gray-400 mb-1">Посилання:</p>
            <p className="text-sm text-white/90 break-all">{bookingUrl}</p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(bookingUrl)
                toast({ title: 'Посилання скопійовано', type: 'success' })
              }}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl text-sm font-medium border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              Копіювати посилання
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push(`/booking/${slug}`)}
            className="flex-1 inline-flex items-center justify-center h-12 px-4 rounded-xl text-sm font-medium border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            Відкрити бронювання
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                const business = getBusinessData()
                if (business) {
                  router.push('/dashboard')
                } else {
                  router.push('/')
                }
              }
            }}
            className="inline-flex items-center justify-center h-12 px-4 rounded-xl text-sm font-medium border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            Назад
          </button>
        </div>
      </div>
    </div>
  )
}

