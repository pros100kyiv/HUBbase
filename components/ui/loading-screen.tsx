/**
 * Екран завантаження з логотипом Xbase і обертовим кільцем.
 * Використовується в app/loading.tsx, dashboard/loading.tsx, booking/[slug]/loading.tsx.
 */
interface LoadingScreenProps {
  /** full — на весь екран (fixed), inline — тільки блок по контенту */
  variant?: 'full' | 'inline'
  /** Текст під логотипом */
  label?: string
}

function LogoWithRing() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Обертове градієнтне кільце */}
      <div
        className="absolute w-[88px] h-[88px] rounded-full animate-loading-ring"
        aria-hidden
      >
        <svg className="w-full h-full" viewBox="0 0 88 88">
          <defs>
            <linearGradient id="loading-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="35%" stopColor="#8b5cf6" />
              <stop offset="65%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
          <circle
            cx="44"
            cy="44"
            r="40"
            fill="none"
            stroke="url(#loading-ring-gradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="80 200"
            strokeDashoffset="0"
          />
        </svg>
      </div>
      {/* Логотип Xbase по центру */}
      <div className="relative w-12 h-12 flex items-center justify-center animate-loading-logo-pulse">
        <svg
          className="w-11 h-11"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <linearGradient id="loading-x-g1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
            <linearGradient id="loading-x-g2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
          </defs>
          <path
            d="M7 7l14 14"
            stroke="url(#loading-x-g1)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M21 7L7 21"
            stroke="url(#loading-x-g2)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  )
}

export function LoadingScreen({ variant = 'full', label = 'Завантажуємо' }: LoadingScreenProps) {
  const isFull = variant === 'full'

  return (
    <div
      className={
        isFull
          ? 'fixed inset-0 z-50 flex items-center justify-center bg-[#08080a] animate-content-fade-in outline-none'
          : 'flex items-center justify-center min-h-[280px] p-8 animate-content-fade-in outline-none'
      }
    >
      <div className="flex flex-col items-center gap-8">
        <LogoWithRing />
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-medium text-white/95 flex items-baseline gap-0.5">
            <span>{label}</span>
            <span className="inline-flex w-5" aria-hidden>
              <span className="animate-[loading-dots-opacity_0.6s_ease-in-out_infinite]">...</span>
            </span>
          </p>
          <span className="text-xs text-white/60 font-medium tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            Xbase
          </span>
        </div>
      </div>
    </div>
  )
}
