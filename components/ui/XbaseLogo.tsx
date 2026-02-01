'use client'

import { cn } from '@/lib/utils'

interface XbaseLogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function XbaseLogo({ className, showText = true, size = 'md' }: XbaseLogoProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8 md:w-10 md:h-10',
    lg: 'w-12 h-12 md:w-16 md:h-16',
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-xs md:text-sm',
    lg: 'text-sm md:text-base',
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Logo Container */}
      <div className={cn('relative', sizeClasses[size])}>
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Abstract circular frame */}
          <g opacity="0.3">
            {/* Outer circle lines */}
            <circle
              cx="60"
              cy="60"
              r="50"
              stroke="url(#gradient1)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              fill="none"
            />
            <circle
              cx="60"
              cy="60"
              r="45"
              stroke="url(#gradient2)"
              strokeWidth="1"
              fill="none"
            />
            
            {/* Connection nodes */}
            <circle cx="60" cy="10" r="2" fill="#3B82F6" />
            <circle cx="110" cy="60" r="2" fill="#60A5FA" />
            <circle cx="60" cy="110" r="2" fill="#3B82F6" />
            <circle cx="10" cy="60" r="2" fill="#60A5FA" />
            <circle cx="85" cy="35" r="1.5" fill="#14B8A6" />
            <circle cx="35" cy="85" r="1.5" fill="#14B8A6" />
            <circle cx="85" cy="85" r="1.5" fill="#3B82F6" />
            <circle cx="35" cy="35" r="1.5" fill="#3B82F6" />
            
            {/* Extending lines */}
            <line x1="60" y1="10" x2="60" y2="5" stroke="url(#gradient1)" strokeWidth="1.5" />
            <line x1="110" y1="60" x2="115" y2="60" stroke="url(#gradient2)" strokeWidth="1.5" />
            <line x1="60" y1="110" x2="60" y2="115" stroke="url(#gradient1)" strokeWidth="1.5" />
            <line x1="10" y1="60" x2="5" y2="60" stroke="url(#gradient2)" strokeWidth="1.5" />
          </g>

          {/* 3D X Symbol */}
          <g transform="translate(60, 50)">
            {/* Left ribbon (blue gradient) */}
            <path
              d="M -20 -20 L -8 -8 L 8 8 L 20 20 L 8 8 L -8 -8 Z"
              fill="url(#xGradient1)"
              opacity="0.9"
            />
            {/* Right ribbon (teal gradient) */}
            <path
              d="M 20 -20 L 8 -8 L -8 8 L -20 20 L -8 8 L 8 -8 Z"
              fill="url(#xGradient2)"
              opacity="0.9"
            />
            {/* Center intersection highlight */}
            <ellipse cx="0" cy="0" rx="6" ry="6" fill="url(#xGradient3)" opacity="0.6" />
          </g>

          {/* Gradients */}
          <defs>
            <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#60A5FA" />
            </linearGradient>
            <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#14B8A6" />
            </linearGradient>
            <linearGradient id="xGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E40AF" />
              <stop offset="50%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#60A5FA" />
            </linearGradient>
            <linearGradient id="xGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0D9488" />
              <stop offset="50%" stopColor="#14B8A6" />
              <stop offset="100%" stopColor="#5EEAD4" />
            </linearGradient>
            <linearGradient id="xGradient3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#14B8A6" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Text */}
      {showText && (
        <span className={cn('font-black', textSizeClasses[size], className?.includes('text-white') ? 'text-white' : 'text-foreground dark:text-white')}>
          Xbase
        </span>
      )}
    </div>
  )
}

