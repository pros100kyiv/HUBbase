'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Route error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
      <h1 className="text-xl font-semibold mb-2">Щось пішло не так</h1>
      <p className="text-sm text-muted-foreground mb-4 max-w-md text-center">
        {error.message || 'Сталася невідома помилка'}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
      >
        Спробувати знову
      </button>
    </div>
  )
}
