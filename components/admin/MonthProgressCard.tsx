'use client'

interface MonthProgressCardProps {
  progress?: number
  overview?: Array<{ label: string; value: number }>
}

export function MonthProgressCard({ progress = 30, overview }: MonthProgressCardProps) {
  const defaultOverview = [
    { label: 'Work', value: 40 },
    { label: 'Meditation', value: 30 },
    { label: "Project's", value: 50 },
  ]

  const data = overview || defaultOverview
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="rounded-xl p-4 md:p-6 card-floating">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="text-base md:text-lg font-semibold text-white" style={{ letterSpacing: '-0.01em' }}>
          Month Progress
        </h3>
        <button className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg transition-colors hidden md:flex">
          <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>

      <p className="text-xs md:text-sm text-gray-300 mb-3 md:mb-4">
        {progress}% completed to last month*
      </p>

      <div className="flex items-start gap-4 md:gap-6 mb-3 md:mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] md:text-xs font-semibold text-gray-400 uppercase mb-1.5 md:mb-2" style={{ letterSpacing: '0.05em' }}>
            OVERVIEW
          </p>
          <div className="space-y-1.5 md:space-y-2">
            {data.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 md:gap-2">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-gray-400 flex-shrink-0"></div>
                <span className="text-xs md:text-sm text-gray-300 truncate">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative w-16 h-16 md:w-24 md:h-24 flex-shrink-0">
          <svg className="w-16 h-16 md:w-24 md:h-24 transform -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="#374151"
              strokeWidth="5"
            />
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="#6366F1"
              strokeWidth="5"
              strokeDasharray={`${(total / 100) * 163.36} 163.36`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm md:text-lg font-bold text-white">120%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg transition-colors hidden md:flex">
          <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
        <button className="flex-1 px-3 md:px-4 py-1.5 md:py-2 bg-white/10 border border-white/20 rounded-lg text-xs md:text-sm font-medium text-white hover:bg-white/20 transition-colors active:scale-[0.98]">
          Download Report
        </button>
      </div>
    </div>
  )
}

