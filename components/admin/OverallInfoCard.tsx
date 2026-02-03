'use client'

interface OverallInfoCardProps {
  onGeneratePlan?: () => void
}

export function OverallInfoCard({ onGeneratePlan }: OverallInfoCardProps) {
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

      {/* Empty State with less bright colors */}
      <div className="text-center">
        {/* Illustration */}
        <div className="mb-6 flex justify-center">
          <div className="relative w-56 h-40">
            {/* Background shape - less bright */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 to-blue-400/10 rounded-3xl blur-2xl"></div>
            
            {/* Monitor */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="relative">
                {/* Monitor base - less bright */}
                <div className="w-28 h-20 bg-gradient-to-br from-purple-500/15 to-purple-600/15 rounded-lg border-2 border-purple-400/20 shadow-lg">
                  {/* Screen content */}
                  <div className="absolute inset-2 flex flex-col gap-1">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-purple-300/25"></div>
                      <div className="w-2 h-2 rounded-full bg-purple-300/25"></div>
                      <div className="w-2 h-2 rounded-full bg-purple-300/25"></div>
                    </div>
                    <div className="flex-1 bg-purple-400/10 rounded"></div>
                  </div>
                </div>
                {/* Monitor stand */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-14 h-2 bg-purple-500/15 rounded"></div>
              </div>
            </div>

            {/* Plant - less bright */}
            <div className="absolute left-6 top-12">
              <div className="relative">
                {/* Pot */}
                <div className="w-6 h-5 bg-purple-400/20 rounded-b-lg"></div>
                {/* Leaves */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="w-5 h-5 bg-purple-300/25 rounded-full"></div>
                  <div className="absolute -top-1.5 left-1.5 w-3 h-3 bg-purple-300/25 rounded-full"></div>
                  <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-purple-300/25 rounded-full"></div>
                </div>
              </div>
            </div>

            {/* Coffee cup - less bright */}
            <div className="absolute right-6 top-14">
              <div className="relative">
                {/* Cup */}
                <div className="w-5 h-6 bg-purple-400/20 rounded-b-lg border-2 border-purple-300/20">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-purple-300/15 rounded-t-lg"></div>
                </div>
                {/* Steam */}
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                  <div className="w-0.5 h-2 bg-purple-200/25 rounded-full animate-pulse"></div>
                  <div className="w-0.5 h-3 bg-purple-200/25 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-0.5 h-2 bg-purple-200/25 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>

            {/* Floating dots - less bright */}
            <div className="absolute top-3 left-10 w-1.5 h-1.5 bg-purple-300/20 rounded-full"></div>
            <div className="absolute bottom-6 right-12 w-1 h-1 bg-purple-300/20 rounded-full"></div>
            <div className="absolute top-10 right-6 w-0.5 h-0.5 bg-purple-300/20 rounded-full"></div>
          </div>
        </div>

        {/* Text - less bright */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div className="px-4 py-2 bg-blue-500/10 rounded-lg">
              <span className="text-sm font-semibold text-gray-300">Сьогодні без завдань</span>
              <span className="ml-2 text-yellow-400/70">🔄</span>
            </div>
          </div>
          
          <div className="px-4 py-2 bg-blue-500/10 rounded-lg inline-block">
            <p className="text-sm text-gray-400">
              Можеш використати момент і додати справи на день
            </p>
          </div>

          <button
            onClick={onGeneratePlan}
            className="text-purple-300/80 hover:text-purple-200/80 underline text-sm font-medium transition-colors"
          >
            Згенерувати план на день
          </button>
        </div>
      </div>
    </div>
  )
}

