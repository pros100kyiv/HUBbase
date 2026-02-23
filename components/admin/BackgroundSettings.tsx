'use client'

import { useState, useEffect, useCallback } from 'react'
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
  const { backgroundColor, setBackgroundColor, gradientIntensity, setGradientIntensity } = useBackground()
  const themeVariant = 'dark' as const
  const defaultColor = '#05050f'
  const displayColor = backgroundColor || defaultColor
  const presets = PRESETS_DARK

  const [hexInput, setHexInput] = useState(displayColor)

  useEffect(() => {
    setHexInput(displayColor)
  }, [displayColor])

  const hsl = hexToHsl(displayColor)
  const lightnessMax = 20
  const saturationMax = 50

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
      <h2 className="text-lg font-bold mb-2 flex items-center gap-2 text-white" style={{ letterSpacing: '-0.02em' }}>
        <PaletteIcon className="w-5 h-5 text-purple-400" />
        Колір фону
      </h2>
      <p className="text-sm text-gray-400 mb-6">
        Оберіть колір фону. Застосовується до body, navbar та sidebar. Зберігається автоматично.
      </p>

      {/* Пресети */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">Швидкий вибір</label>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.hex}
              type="button"
              onClick={() => setBackgroundColor(p.hex, themeVariant)}
              className={cn(
                'w-10 h-10 rounded-lg border-2 transition-all shrink-0 hover:scale-110 hover:ring-2 hover:ring-white/30',
                displayColor === p.hex ? 'border-white ring-2 ring-white/40 scale-105' : 'border-white/20'
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
          <label className="block text-sm font-medium text-gray-300 mb-2">Відтінок</label>
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
          <label className="block text-sm font-medium text-gray-300 mb-2">Насиченість</label>
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
          <label className="block text-sm font-medium text-gray-300 mb-2">Яскравість</label>
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
        <label className="block text-sm font-medium text-gray-300 mb-2">Hex код</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={handleHexSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleHexSubmit()}
            placeholder="#05050f"
            className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
          />
          <div
            className="w-10 h-10 rounded-lg border border-white/20 shrink-0"
            style={{ backgroundColor: (() => { const n = hexInput.startsWith('#') ? hexInput : `#${hexInput}`; return isValidHex(n) ? n : displayColor; })() }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">Введіть #RRGGBB та натисніть Enter або клікніть поза полем</p>
      </div>

      {/* Інтенсивність градієнтів */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">Інтенсивність градієнтів</label>
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
      <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-white/5 border border-white/10">
        <div
          className="w-14 h-14 rounded-xl border border-white/20 shrink-0"
          style={{ backgroundColor: displayColor }}
        />
        <div>
          <p className="text-sm font-medium text-white">{displayColor}</p>
          <p className="text-xs text-gray-500">Поточний колір фону</p>
        </div>
      </div>

      {/* Скинути */}
      <button
        type="button"
        onClick={handleReset}
        className="px-4 py-2 rounded-lg text-sm font-medium border border-white/20 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
      >
        Скинути до стандарту
      </button>
    </div>
  )
}
