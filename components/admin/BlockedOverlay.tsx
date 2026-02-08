'use client'

import { useRouter } from 'next/navigation'

interface BlockedOverlayProps {
  blockReason?: string | null
  blockedAt?: string | null
}

/**
 * Повноекранний оверлей «Доступ заблоковано» — показується заблокованому бізнесу в дашборді.
 * Обмежує весь функціонал до моменту розблокування.
 */
export function BlockedOverlay({ blockReason, blockedAt }: BlockedOverlayProps) {
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem('business')
    router.push('/login')
  }

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md"
      style={{ 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        padding: 'max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))',
      }}
    >
      <div className="max-w-md w-full mx-auto p-6 rounded-2xl card-glass-elevated border border-red-500/30 text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
        </div>
        <h2 className="text-xl font-bold text-white">Доступ заблоковано</h2>
        <p className="text-gray-300 text-sm">
          Ваш акаунт заблоковано. Зверніться до адміністратора системи для зняття блокування.
        </p>
        {blockReason && (
          <div className="rounded-lg p-3 bg-red-500/10 border border-red-500/20 text-left">
            <p className="text-xs text-gray-400 mb-1">Причина блокування:</p>
            <p className="text-sm text-red-200">{blockReason}</p>
          </div>
        )}
        {blockedAt && (
          <p className="text-xs text-gray-500">
            Заблоковано: {new Date(blockedAt).toLocaleString('uk-UA')}
          </p>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="touch-target mt-4 px-6 py-3 min-h-[48px] rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 font-medium transition-colors active:scale-[0.98]"
        >
          Вийти з акаунту
        </button>
      </div>
    </div>
  )
}
