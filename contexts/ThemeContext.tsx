'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type Theme = 'light' | 'dark' | 'oled'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  /** Перемикає тему по колу: light → dark → oled → light */
  cycleTheme: () => void
  /** Зворотна сумісність: перемикає лише light ↔ dark (без oled) */
  toggleTheme: () => void
  mounted: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = 'theme'

const THEME_ORDER: Theme[] = ['light', 'dark', 'oled']

function applyTheme(newTheme: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove('light', 'dark', 'oled')
  if (newTheme === 'light') {
    root.classList.add('light')
  } else if (newTheme === 'oled') {
    root.classList.add('dark', 'oled')
  } else {
    root.classList.add('dark')
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    const hasDark = root.classList.contains('dark')
    const hasOled = root.classList.contains('oled')
    const currentTheme: Theme = hasOled ? 'oled' : hasDark ? 'dark' : 'light'

    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
    const validSaved = savedTheme && THEME_ORDER.includes(savedTheme)
    if (validSaved && savedTheme !== currentTheme) {
      applyTheme(savedTheme)
      setThemeState(savedTheme)
    } else {
      setThemeState(currentTheme)
    }

    setMounted(true)
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    applyTheme(newTheme)
  }

  const cycleTheme = () => {
    const idx = THEME_ORDER.indexOf(theme)
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length]
    setTheme(next)
  }

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
  }

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
