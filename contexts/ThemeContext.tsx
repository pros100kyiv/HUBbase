'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

/** Єдина тема — OLED */
export type Theme = 'oled'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  cycleTheme: () => void
  toggleTheme: () => void
  mounted: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function applyTheme() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add('dark', 'oled')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme] = useState<Theme>('oled')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    applyTheme()
    setMounted(true)
  }, [])

  const setTheme = () => { /* єдина тема, нічого не робимо */ }
  const cycleTheme = () => { /* єдина тема */ }
  const toggleTheme = () => { /* єдина тема */ }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
