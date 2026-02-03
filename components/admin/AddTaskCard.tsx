'use client'

interface AddTaskCardProps {
  onClick?: () => void
}

export function AddTaskCard({ onClick }: AddTaskCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 w-full h-full flex flex-col items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors"
      style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)' }}
    >
      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <span className="text-sm font-medium text-gray-600">+ Add a task</span>
    </button>
  )
}

