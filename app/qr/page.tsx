'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent } from '@/components/ui/card'

export default function QRPage() {
  const [bookingUrl, setBookingUrl] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setBookingUrl(window.location.origin + '/booking')
  }, [])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8">
          <h1 className="text-3xl font-bold text-title text-primary dark:text-blue-400 mb-6 text-center">
            QR КОД ДЛЯ БРОНЮВАННЯ
          </h1>
          <div className="flex justify-center mb-6">
            <div className="relative">
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
          {mounted && (
            <div className="bg-white dark:bg-gray-800 rounded-md p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">Посилання:</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 break-all">{bookingUrl || 'Завантаження...'}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

