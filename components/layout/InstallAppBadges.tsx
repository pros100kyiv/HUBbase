'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallBadgesVariant = 'compact' | 'full'

interface InstallAppBadgesProps {
  variant?: InstallBadgesVariant
  className?: string
}

type Platform = 'ios' | 'android' | 'desktop' | null

export function InstallAppBadges({ variant = 'compact', className }: InstallAppBadgesProps) {
  const [platform, setPlatform] = useState<Platform>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return

    // Пристрій вже встановлений (standalone mode)
    const standalone =
      (window.navigator as Navigator & { standalone?: boolean }).standalone ?? document.referrer.includes('android-app')
    const inStandalone = window.matchMedia('(display-mode: standalone)').matches || standalone
    if (inStandalone) {
      setIsInstalled(true)
      return
    }

    // Визначаємо платформу
    const ua = navigator.userAgent.toLowerCase()
    const isIOS = /iphone|ipad|ipod/.test(ua)
    const isAndroid = /android/.test(ua)
    const isMobile = isIOS || isAndroid

    if (isIOS) setPlatform('ios')
    else if (isAndroid) setPlatform('android')
    else if (isMobile) setPlatform('android') // fallback
    else setPlatform('desktop')
  }, [mounted])

  useEffect(() => {
    if (!mounted || platform === null) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [mounted, platform])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
  }

  if (!mounted || isInstalled || platform === null) return null

  // Desktop: показуємо тільки якщо є beforeinstallprompt (Chrome)
  if (platform === 'desktop' && !deferredPrompt) return null

  // Android: показуємо тільки коли є deferredPrompt
  const showAndroid = platform === 'android' && deferredPrompt
  const showIOS = platform === 'ios'
  const showDesktop = platform === 'desktop' && deferredPrompt
  if (!showAndroid && !showIOS && !showDesktop) return null

  const fullVariantButtonClass = 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-colors border border-white/20 bg-white/10 hover:bg-white/20'

  if (variant === 'full') {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        <p className="text-sm text-gray-400 text-center">Встановіть додаток для зручного доступу</p>
        <div className="flex flex-wrap justify-center gap-2">
          {showAndroid && (
            <button
              type="button"
              onClick={handleInstall}
              className={fullVariantButtonClass}
            >
              <GooglePlayIcon className="w-5 h-5" />
              <span>Встановити для Android</span>
            </button>
          )}
          {showIOS && (
            <button
              type="button"
              onClick={() => setShowIOSInstructions(true)}
              className={fullVariantButtonClass}
            >
              <AppleIcon className="w-5 h-5" />
              <span>Додати на головний екран</span>
            </button>
          )}
          {showDesktop && (
            <button
              type="button"
              onClick={handleInstall}
              className={fullVariantButtonClass}
            >
              <span>Встановити додаток</span>
            </button>
          )}
        </div>

        {showIOSInstructions && (
          <IOSInstructionsModal onClose={() => setShowIOSInstructions(false)} />
        )}
      </div>
    )
  }

  // Compact — маленькі значки як в App Store / Play Store
  return (
    <>
      <div className={cn('flex items-center justify-center gap-2', className)}>
        {showAndroid && (
          <button
            type="button"
            onClick={handleInstall}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 dark:bg-white/10 dark:hover:bg-white/20 border border-white/20 text-white text-xs font-medium transition-colors"
          >
            <GooglePlayIcon className="w-4 h-4 flex-shrink-0" />
            <span>Встановити</span>
          </button>
        )}
        {showIOS && (
          <button
            type="button"
            onClick={() => setShowIOSInstructions(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 dark:bg-white/10 dark:hover:bg-white/20 border border-white/20 text-white text-xs font-medium transition-colors"
          >
            <AppleIcon className="w-4 h-4 flex-shrink-0" />
            <span>Додати на екран</span>
          </button>
        )}
        {showDesktop && (
          <button
            type="button"
            onClick={handleInstall}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 dark:bg-white/10 dark:hover:bg-white/20 border border-white/20 text-white text-xs font-medium transition-colors"
          >
            <span>Встановити додаток</span>
          </button>
        )}
      </div>

      {showIOSInstructions && (
        <IOSInstructionsModal onClose={() => setShowIOSInstructions(false)} />
      )}
    </>
  )
}

function IOSInstructionsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-gray-900 border border-white/10 p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-200">
        <h2 id="ios-install-title" className="text-lg font-semibold text-white mb-4">
          Додати на головний екран
        </h2>
        <ol className="space-y-3 text-sm text-gray-300 mb-6">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white font-medium">1</span>
            <span>Натисніть кнопку <strong className="text-white">Поділитися</strong> внизу екрана</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white font-medium">2</span>
            <span>Прокрутіть і виберіть <strong className="text-white">«На екран Дома»</strong></span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white font-medium">3</span>
            <span>Натисніть <strong className="text-white">«Додати»</strong></span>
          </li>
        </ol>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 transition-colors"
        >
          Зрозуміло
        </button>
      </div>
    </div>
  )
}

function GooglePlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M3.609 1.814L13.792 12 3.61 22.186a1 1 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" />
    </svg>
  )
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}
