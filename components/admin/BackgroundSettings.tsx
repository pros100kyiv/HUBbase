'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useBackground } from '@/contexts/BackgroundContext'
import { PaletteIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

const PRESETS_DARK: { hex: string; label: string }[] = [
  { hex: '#000000', label: 'Чорний' },
  { hex: '#0A0A0A', label: 'Глибокий чорний' },
  { hex: '#0d0d0d', label: 'Матовий чорний' },
  { hex: '#111111', label: 'Мʼякий чорний' },
  { hex: '#05050f', label: 'Стандарт' },
  { hex: '#0F172A', label: 'Темно-синій' },
  { hex: '#0c1222', label: 'Морський' },
  { hex: '#0a1628', label: 'Індиго' },
  { hex: '#0e1628', label: 'Півоночі' },
  { hex: '#0d1117', label: 'GitHub' },
  { hex: '#0d0d14', label: 'Темно-фіолетовий' },
  { hex: '#0f0d14', label: 'Баклажановий' },
  { hex: '#120f1a', label: 'Пурпурний' },
  { hex: '#1a1a1e', label: 'Темно-сірий' },
  { hex: '#0f1419', label: 'Графіт' },
  { hex: '#161618', label: 'Димчастий' },
  { hex: '#1c1c1e', label: 'Сірий' },
  { hex: '#18181b', label: 'Цинковий' },
  { hex: '#0a0f14', label: 'Темно-зелений' },
  { hex: '#0d1419', label: 'Морська хвиля' },
  { hex: '#0f1614', label: 'Кипарис' },
  { hex: '#14120d', label: 'Темно-коричневий' },
  { hex: '#1a1612', label: 'Кава' },
  { hex: '#150d0d', label: 'Темно-червоний' },
  { hex: '#140d10', label: 'Винний' },
]

const PRESETS_LIGHT: { hex: string; label: string }[] = [
  { hex: '#F2F2F7', label: 'Стандартний' },
  { hex: '#FFFFFF', label: 'Білий' },
  { hex: '#F8FAFC', label: 'Сніжно-білий' },
  { hex: '#FAFAFA', label: 'Мʼякий білий' },
  { hex: '#F1F5F9', label: 'Сірий світлий' },
  { hex: '#EFF6FF', label: 'Блакитний світлий' },
  { hex: '#F5F3FF', label: 'Фіолетовий світлий' },
  { hex: '#F0FDF4', label: 'Зелений світлий' },
  { hex: '#FFFBEB', label: 'Теплий світлий' },
  { hex: '#FFF7ED', label: 'Персиковий' },
  { hex: '#FDF2F8', label: 'Рожевий світлий' },
  { hex: '#ECFDF5', label: 'Мʼятний' },
  { hex: '#EEF2FF', label: 'Індиго світлий' },
  { hex: '#FAF5FF', label: 'Лавандовий' },
  { hex: '#F0FDFA', label: 'Бірюзовий' },
  { hex: '#FFFAF0', label: 'Кремовий' },
]

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h2 = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h2 = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h2 = ((b - r) / d + 2) / 6; break
      case b: h2 = ((r - g) / d + 4) / 6; break
    }
  }
  return {
    h: Math.round(h2 * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

function isValidHex(s: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(s)
}

export function BackgroundSettings() {
  const { theme } = useTheme()
  const { backgroundColor, backgroundColorLight, setBackgroundColor, gradientIntensity, setGradientIntensity } = useBackground()
  const isDarkTheme = theme === 'dark' || theme === 'oled'
  const themeVariant: 'light' | 'dark' = isDarkTheme ? 'dark' : 'light'
  const defaultColor = theme === 'oled' ? '#000000' : isDarkTheme ? '#0F172A' : '#F2F2F7'
  const displayColor = isDarkTheme ? (backgroundColor || defaultColor) : (backgroundColorLight || defaultColor)
  const presets = isDarkTheme ? PRESETS_DARK : PRESETS_LIGHT

  const [hexInput, setHexInput] = useState(displayColor)

  useEffect(() => {
    setHexInput(displayColor)
  }, [displayColor])

  const hsl = hexToHsl(displayColor)
  const lightnessMax = isDarkTheme ? 20 : 100
  const saturationMax = isDarkTheme ? 50 : 40

  const setFromHsl = useCallback((h: number, s: number, l: number) => {
    const hex = hslToHex(h, s, l)
    setBackgroundColor(hex, themeVariant)
    setHexInput(hex)
  }, [setBackgroundColor, themeVariant])

  const handleHueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const h = parseInt(e.target.value, 10)
    setFromHsl(h, hsl.s, hsl.l)
  }
  const handleSatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = parseInt(e.target.value, 10)
    setFromHsl(hsl.h, s, hsl.l)
  }
  const handleLightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const l = parseInt(e.target.value, 10)
    setFromHsl(hsl.h, hsl.s, l)
  }

  const handleHexSubmit = () => {
    const v = hexInput.startsWith('#') ? hexInput : `#${hexInput}`
    if (isValidHex(v)) {
      setBackgroundColor(v, themeVariant)
    } else {
      setHexInput(displayColor)
    }
  }

  const handleReset = () => {
    setBackgroundColor(null, themeVariant)
    setGradientIntensity(100)
  }

  return (
    <div className="rounded-xl p-4 md:p-6 card-glass">
      <h2 className={cn('text-lg font-bold mb-2 flex items-center gap-2', isDarkTheme ? 'text-white' : 'text-gray-900')} style={{ letterSpacing: '-0.02em' }}>
        <PaletteIcon className={cn('w-5 h-5', isDarkTheme ? 'text-purple-400' : 'text-purple-600')} />
        Колір фону
      </h2>
      <p className={cn('text-sm mb-6', isDarkTheme ? 'text-gray-400' : 'text-gray-600')}>
        Оберіть колір фону для {isDarkTheme ? 'темної теми' : 'світлої теми'}. Застосовується до body, navbar та sidebar. Зберігається окремо для кожної теми.
      </p>

      {/* Пресети */}
      <div className="mb-6">
        <label className={cn('block text-sm font-medium mb-3', isDarkTheme ? 'text-gray-300' : 'text-gray-700')}>Швидкий вибір</label>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.hex}
              type="button"
              onClick={() => setBackgroundColor(p.hex, themeVariant)}
              className={cn(
                'w-10 h-10 rounded-lg border-2 transition-all shrink-0',
                isDarkTheme
                  ? 'hover:scale-110 hover:ring-2 hover:ring-white/30'
                  : 'hover:scale-110 hover:ring-2 hover:ring-black/20',
                displayColor === p.hex
                  ? isDarkTheme ? 'border-white ring-2 ring-white/40 scale-105' : 'border-gray-700 ring-2 ring-gray-600 scale-105'
                  : isDarkTheme ? 'border-white/20' : 'border-gray-300'
              )}
              style={{ backgroundColor: p.hex }}
              title={p.label}
              aria-label={p.label}
            />
          ))}
        </div>
      </div>

      {/* HSL повзунки */}
      <div className="space-y-4 mb-6">
        <div>
          <label className={cn('block text-sm font-medium mb-2', isDarkTheme ? 'text-gray-300' : 'text-gray-700')}>Відтінок</label>
          <input
            type="range"
            min="0"
            max="360"
            value={hsl.h}
            onChange={handleHueChange}
            className="w-full h-2 rounded-full appearance-none bg-white/10 accent-purple-500"
          />
        </div>
        <div>
          <label className={cn('block text-sm font-medium mb-2', isDarkTheme ? 'text-gray-300' : 'text-gray-700')}>Насиченість</label>
          <input
            type="range"
            min="0"
            max={saturationMax}
            value={Math.min(hsl.s, saturationMax)}
            onChange={handleSatChange}
            className="w-full h-2 rounded-full appearance-none bg-white/10 accent-purple-500"
          />
        </div>
        <div>
          <label className={cn('block text-sm font-medium mb-2', isDarkTheme ? 'text-gray-300' : 'text-gray-700')}>Яскравість</label>
          <input
            type="range"
            min="0"
            max={lightnessMax}
            value={Math.min(hsl.l, lightnessMax)}
            onChange={handleLightChange}
            className="w-full h-2 rounded-full appearance-none bg-white/10 accent-purple-500"
          />
        </div>
      </div>

      {/* Hex input */}
      <div className="mb-6">
        <label className={cn('block text-sm font-medium mb-2', isDarkTheme ? 'text-gray-300' : 'text-gray-700')}>Hex код</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={handleHexSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleHexSubmit()}
            placeholder={isDarkTheme ? '#05050f' : '#F2F2F7'}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg font-mono text-sm focus:outline-none focus:ring-2',
              isDarkTheme
                ? 'bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:ring-white/30'
                : 'bg-black/5 border border-black/20 text-gray-900 placeholder-gray-500 focus:ring-black/20'
            )}
          />
          <div
            className={cn(
              'w-10 h-10 rounded-lg border shrink-0',
              isDarkTheme ? 'border-white/20' : 'border-gray-300'
            )}
            style={{ backgroundColor: (() => { const n = hexInput.startsWith('#') ? hexInput : `#${hexInput}`; return isValidHex(n) ? n : displayColor; })() }}
          />
        </div>
        <p className={cn('text-xs mt-1', isDarkTheme ? 'text-gray-500' : 'text-gray-600')}>Введіть #RRGGBB та натисніть Enter або клікніть поза полем</p>
      </div>

      {/* Інтенсивність градієнтів */}
      <div className="mb-6">
        <label className={cn('block text-sm font-medium mb-2', isDarkTheme ? 'text-gray-300' : 'text-gray-700')}>Інтенсивність градієнтів</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="100"
            value={gradientIntensity}
            onChange={(e) => setGradientIntensity(parseInt(e.target.value, 10))}
            className="flex-1 h-2 rounded-full appearance-none bg-white/10 accent-purple-500"
          />
          <span className="text-sm text-gray-400 w-10">{gradientIntensity}%</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">0% — без декоративних градієнтів, 100% — повна інтенсивність</p>
      </div>

      {/* Превʼю */}
      <div className={cn(
        'flex items-center gap-3 mb-6 p-3 rounded-lg border',
        isDarkTheme ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'
      )}>
        <div
          className={cn(
            'w-14 h-14 rounded-xl border shrink-0',
            isDarkTheme ? 'border-white/20' : 'border-black/20'
          )}
          style={{ backgroundColor: displayColor }}
        />
        <div>
          <p className={cn(
            'text-sm font-medium',
            isDarkTheme ? 'text-white' : 'text-gray-900'
          )}>{displayColor}</p>
          <p className={cn('text-xs', isDarkTheme ? 'text-gray-500' : 'text-gray-600')}>Поточний колір фону</p>
        </div>
      </div>

      {/* Скинути */}
      <button
        type="button"
        onClick={handleReset}
        className={cn(
          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          isDarkTheme
            ? 'border border-white/20 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            : 'border border-black/20 bg-black/5 text-gray-600 hover:bg-black/10 hover:text-gray-900'
        )}
      >
        Скинути до стандарту
      </button>
    </div>
  )
}
