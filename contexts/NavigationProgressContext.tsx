'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'

type NavigationProgressContextType = {
  startNavigation: () => void
  finishNavigation: () => void
  isNavigating: boolean
}

const NavigationProgressContext = createContext<NavigationProgressContextType | null>(null)

export function useNavigationProgress() {
  const ctx = useContext(NavigationProgressContext)
  return ctx ?? { startNavigation: () => {}, finishNavigation: () => {}, isNavigating: false }
}

export function NavigationProgressProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isNavigating, setIsNavigating] = useState(false)
  const prevPathnameRef = React.useRef<string | null>(null)

  const startNavigation = useCallback(() => setIsNavigating(true), [])
  const finishNavigation = useCallback(() => setIsNavigating(false), [])

  useEffect(() => {
    if (prevPathnameRef.current !== null && prevPathnameRef.current !== pathname) {
      setIsNavigating(false)
    }
    prevPathnameRef.current = pathname
  }, [pathname])

  return (
    <NavigationProgressContext.Provider value={{ startNavigation, finishNavigation, isNavigating }}>
      {/* Тонка смуга зверху — градієнт, indeterminate анімація */}
      {isNavigating && (
        <div
          className="fixed top-0 left-0 right-0 z-[9999] h-0.5 overflow-hidden"
          style={{ background: 'rgba(20,20,20,0.5)' }}
          aria-hidden
        >
          <div
            className="h-full w-1/3 min-w-[120px] rounded-r-full animate-[navigation-progress_1.4s_ease-in-out_infinite]"
            style={{
              background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              boxShadow: '0 0 12px rgba(99, 102, 241, 0.5)',
            }}
          />
        </div>
      )}
      {children}
    </NavigationProgressContext.Provider>
  )
}
