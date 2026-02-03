'use client'

import { EyeIcon, ArrowUpIcon, CheckIcon } from '@/components/icons'

interface OverallInfoCardProps {
  totalTasks: number
  stoppedProjects: number
  totalProjects: number
  inProgress: number
  completed: number
}

export function OverallInfoCard({
  totalTasks,
  stoppedProjects,
  totalProjects,
  inProgress,
  completed,
}: OverallInfoCardProps) {
  const progress = totalProjects > 0 ? (completed / totalProjects) * 100 : 0

  return (
    <div className="bg-[#1A1A1A] text-white rounded-xl p-6 card-floating">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white" style={{ letterSpacing: '-0.01em' }}>
          Мій день
        </h3>
        <div className="flex items-center gap-2">
          {/* Share icon - two circles connected */}
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="9" cy="9" r="3" strokeWidth={2} />
              <circle cx="15" cy="15" r="3" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v6m0 0l-3-3m3 3l3-3" />
            </svg>
          </button>
          {/* Three dots menu */}
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex items-start gap-8 mb-6">
        <div>
          <div className="text-4xl font-bold text-white mb-1" style={{ letterSpacing: '-0.02em' }}>
            {totalTasks}
          </div>
          <div className="text-sm text-gray-300">Виконано за весь час</div>
        </div>
        <div>
          <div className="text-4xl font-bold text-white mb-1" style={{ letterSpacing: '-0.02em' }}>
            {stoppedProjects}
          </div>
          <div className="text-sm text-gray-300">Проєктів зупинено</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white/30 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Small Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg p-3 border border-white/10" style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.2)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-700 font-medium">{totalProjects} Проєктів</span>
            <EyeIcon className="w-4 h-4 text-gray-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-white/10" style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.2)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-700 font-medium">{inProgress} В процесі</span>
            <ArrowUpIcon className="w-4 h-4 text-gray-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-white/10" style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.2)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-700 font-medium">{completed} Завершено</span>
            <CheckIcon className="w-4 h-4 text-gray-500" />
          </div>
        </div>
      </div>
    </div>
  )
}

