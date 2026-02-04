'use client'

interface AddTaskCardProps {
  onClick?: () => void
}

export function AddTaskCard({ onClick }: AddTaskCardProps) {
  return (
    <button
      onClick={onClick}
      className="border-2 border-dashed border-white/20 rounded-xl p-4 md:p-6 w-full h-full flex flex-col items-center justify-center hover:border-white/30 hover:bg-white/5 transition-all card-floating active:scale-[0.98] min-h-[120px] md:min-h-0"
    >
      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 flex items-center justify-center mb-2 md:mb-3">
        <svg className="w-5 h-5 md:w-6 md:h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <span className="text-xs md:text-sm font-medium text-gray-300">+ Add a task</span>
    </button>
  )
}

