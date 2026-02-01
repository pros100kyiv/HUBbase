import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'success' | 'error' | 'warning' | 'info' | 'default'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    success: 'bg-candy-mint/10 text-candy-mint border-candy-mint/20',
    error: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-500/20',
    warning: 'bg-candy-orange/10 text-candy-orange border-candy-orange/20',
    info: 'bg-candy-blue/10 text-candy-blue border-candy-blue/20',
    default: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}



