'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang="uk">
      <body className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#050505] text-white">
        <h1 className="text-xl font-semibold mb-2">Критична помилка</h1>
        <p className="text-sm text-gray-400 mb-4 max-w-md text-center">
          {error.message || 'Щось пішло не так'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-white text-black hover:opacity-90 transition-opacity"
        >
          Спробувати знову
        </button>
      </body>
    </html>
  )
}
