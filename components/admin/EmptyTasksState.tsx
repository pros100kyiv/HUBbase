'use client'

interface EmptyTasksStateProps {
  onGeneratePlan?: () => void
}

export function EmptyTasksState({ onGeneratePlan }: EmptyTasksStateProps) {
  return (
    <div className="rounded-xl p-8 card-floating text-center">
      {/* Illustration */}
      <div className="mb-6 flex justify-center">
        <div className="relative w-64 h-48">
          {/* Background shape */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-blue-400/20 rounded-3xl blur-2xl"></div>
          
          {/* Monitor */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              {/* Monitor base */}
              <div className="w-32 h-24 bg-gradient-to-br from-purple-500/30 to-purple-600/30 rounded-lg border-2 border-purple-400/50 shadow-lg">
                {/* Screen content */}
                <div className="absolute inset-2 flex flex-col gap-1">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-purple-300/50"></div>
                    <div className="w-2 h-2 rounded-full bg-purple-300/50"></div>
                    <div className="w-2 h-2 rounded-full bg-purple-300/50"></div>
                  </div>
                  <div className="flex-1 bg-purple-400/20 rounded"></div>
                </div>
              </div>
              {/* Monitor stand */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-2 bg-purple-500/30 rounded"></div>
            </div>
          </div>

          {/* Plant */}
          <div className="absolute left-8 top-16">
            <div className="relative">
              {/* Pot */}
              <div className="w-8 h-6 bg-purple-400/40 rounded-b-lg"></div>
              {/* Leaves */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="w-6 h-6 bg-purple-300/50 rounded-full"></div>
                <div className="absolute -top-2 left-2 w-4 h-4 bg-purple-300/50 rounded-full"></div>
                <div className="absolute -top-2 -left-2 w-4 h-4 bg-purple-300/50 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Coffee cup */}
          <div className="absolute right-8 top-20">
            <div className="relative">
              {/* Cup */}
              <div className="w-6 h-8 bg-purple-400/40 rounded-b-lg border-2 border-purple-300/50">
                <div className="absolute top-0 left-0 right-0 h-2 bg-purple-300/30 rounded-t-lg"></div>
              </div>
              {/* Steam */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1">
                <div className="w-1 h-3 bg-purple-200/50 rounded-full animate-pulse"></div>
                <div className="w-1 h-4 bg-purple-200/50 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1 h-3 bg-purple-200/50 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>

          {/* Floating dots */}
          <div className="absolute top-4 left-12 w-2 h-2 bg-purple-300/40 rounded-full"></div>
          <div className="absolute bottom-8 right-16 w-1.5 h-1.5 bg-purple-300/40 rounded-full"></div>
          <div className="absolute top-12 right-8 w-1 h-1 bg-purple-300/40 rounded-full"></div>
        </div>
      </div>

      {/* Text */}
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2">
          <div className="px-4 py-2 bg-blue-500/20 rounded-lg">
            <span className="text-sm font-semibold text-white">Сьогодні без завдань</span>
            <span className="ml-2 text-yellow-400">🔄</span>
          </div>
        </div>
        
        <div className="px-4 py-2 bg-blue-500/20 rounded-lg inline-block">
          <p className="text-sm text-gray-300">
            Можеш використати момент і додати справи на день
          </p>
        </div>

        <button
          onClick={onGeneratePlan}
          className="text-purple-400 hover:text-purple-300 underline text-sm font-medium transition-colors"
        >
          Згенерувати план на день
        </button>
      </div>
    </div>
  )
}

