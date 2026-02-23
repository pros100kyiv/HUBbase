'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

const COLOR_KEY_DARK = 'custom-bg-color'
const COLOR_KEY_LIGHT = 'custom-bg-color-light'
const GRADIENT_KEY = 'custom-bg-gradient'

export type ThemeVariant = 'light' | 'dark'

interface BackgroundContextType {
  /** Колір для темної/OLED теми */
  backgroundColor: string | null
  /** Колір для світлої теми */
  backgroundColorLight: string | null
  setBackgroundColor: (color: string | null, theme: ThemeVariant) => void
  gradientIntensity: number
  setGradientIntensity: (value: number) => void
}

const BackgroundContext = createContext<BackgroundContextType | undefined>(undefined)

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [backgroundColor, setColorState] = useState<string | null>(null)
  const [backgroundColorLight, setColorLightState] = useState<string | null>(null)
  const [gradientIntensity, setGradientState] = useState(100)

  useEffect(() => {
    try {
      const dark = localStorage.getItem(COLOR_KEY_DARK)
      if (dark && /^#[0-9a-fA-F]{6}$/.test(dark)) {
        setColorState(dark)
        applyColorDark(dark)
      }
      const light = localStorage.getItem(COLOR_KEY_LIGHT)
      if (light && /^#[0-9a-fA-F]{6}$/.test(light)) {
        setColorLightState(light)
        applyColorLight(light)
      }
      const g = localStorage.getItem(GRADIENT_KEY)
      if (g != null) {
        const v = parseInt(g, 10)
        if (v >= 0 && v <= 100) {
          setGradientState(v)
          applyGradient(v)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  const setBackgroundColor = (color: string | null, theme: ThemeVariant) => {
    if (theme === 'light') {
      setColorLightState(color)
      if (color) {
        localStorage.setItem(COLOR_KEY_LIGHT, color)
        applyColorLight(color)
      } else {
        localStorage.removeItem(COLOR_KEY_LIGHT)
        applyColorLight(null)
      }
    } else {
      setColorState(color)
      if (color) {
        localStorage.setItem(COLOR_KEY_DARK, color)
        applyColorDark(color)
      } else {
        localStorage.removeItem(COLOR_KEY_DARK)
        applyColorDark(null)
      }
    }
  }

  const setGradientIntensity = (value: number) => {
    const v = Math.max(0, Math.min(100, Math.round(value)))
    setGradientState(v)
    localStorage.setItem(GRADIENT_KEY, String(v))
    applyGradient(v)
  }

  return (
    <BackgroundContext.Provider value={{ backgroundColor, backgroundColorLight, setBackgroundColor, gradientIntensity, setGradientIntensity }}>
      {children}
    </BackgroundContext.Provider>
  )
}

function applyColorDark(color: string | null) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (color) {
    root.style.setProperty('--custom-bg-base', color)
    root.dataset.customBg = '1'
  } else {
    root.style.removeProperty('--custom-bg-base')
    delete root.dataset.customBg
  }
}

function applyColorLight(color: string | null) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (color) {
    root.style.setProperty('--custom-bg-light', color)
    root.dataset.customBgLight = '1'
  } else {
    root.style.removeProperty('--custom-bg-light')
    delete root.dataset.customBgLight
  }
}

function applyGradient(intensity: number) {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--custom-gradient-opacity', String(intensity / 100))
}

export function useBackground() {
  const ctx = useContext(BackgroundContext)
  if (ctx === undefined) {
    throw new Error('useBackground must be used within BackgroundProvider')
  }
  return ctx
}
