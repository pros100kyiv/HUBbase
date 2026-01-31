'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const dataParam = searchParams.get('data')
    
    if (dataParam) {
      try {
        const businessData = JSON.parse(decodeURIComponent(dataParam))
        
        // Зберігаємо дані в localStorage
        localStorage.setItem('business', JSON.stringify(businessData))
        
        // Перенаправляємо на dashboard
        router.push('/dashboard')
      } catch (error) {
        console.error('Error parsing auth data:', error)
        router.push('/login?error=parse_error')
      }
    } else {
      router.push('/login?error=no_data')
    }
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-gray-600 dark:text-gray-400">Завершення входу...</p>
      </div>
    </div>
  )
}

