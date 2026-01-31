'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  mounted: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Тема вже встановлена скриптом в <head>, просто синхронізуємо стан
    const root = document.documentElement
    const isDark = root.classList.contains('dark')
    const currentTheme = isDark ? 'dark' : 'light'
    
    // Якщо тема не збігається з localStorage, оновлюємо
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme && savedTheme !== currentTheme) {
      applyTheme(savedTheme)
      setTheme(savedTheme)
    } else {
      setTheme(currentTheme)
    }
    
    setMounted(true)
  }, [])

  const applyTheme = (newTheme: Theme) => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(newTheme)
  }

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, mounted }}>
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

