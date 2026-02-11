'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'

const QRCodeSVG = dynamic(
  () => import('qrcode.react').then((m) => ({ default: m.QRCodeSVG })),
  { ssr: false }
)
import { Button } from '@/components/ui/button'
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Slug не знайдено</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8">
          <h1 className="text-3xl font-bold text-title text-primary mb-6 text-center">
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
                <div className="w-64 h-64 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center">
                  <p className="text-gray-400 dark:text-gray-600 text-sm">Завантаження...</p>
                </div>
              )}
            </div>
          </div>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-4">
            Відскануйте QR код для швидкого доступу до бронювання
          </p>
          <div className="flex justify-center mb-4">
            <InstallAppBadges variant="full" />
          </div>
          {mounted && bookingUrl && (
            <div className="bg-white dark:bg-gray-800 rounded-md p-4 text-center mb-4 space-y-2 animate-content-fade-in">
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">Посилання:</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 break-all">{bookingUrl}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(bookingUrl)
                  toast({ title: 'Посилання скопійовано', type: 'success' })
                }}
              >
                Копіювати посилання
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push(`/booking/${slug}`)}
            >
              Відкрити бронювання
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  const business = localStorage.getItem('business')
                  if (business) {
                    router.push('/dashboard')
                  } else {
                    router.push('/')
                  }
                }
              }}
            >
              Назад
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

