'use client'

import { CheckIcon } from '@/components/icons'

interface Goal {
  id: string
  text: string
  completed: boolean
}

interface MonthGoalsCardProps {
  goals: Goal[]
  onToggleGoal?: (id: string) => void
  onEdit?: () => void
}

export function MonthGoalsCard({ goals, onToggleGoal, onEdit }: MonthGoalsCardProps) {
  const defaultGoals: Goal[] = [
    { id: '1', text: '1h Meditation', completed: true },
    { id: '2', text: '10m Running', completed: true },
    { id: '3', text: '30m Workout', completed: true },
    { id: '4', text: "30m Pooja & read book", completed: false },
  ]

  const displayGoals = goals.length > 0 ? goals : defaultGoals
  const completedCount = displayGoals.filter(g => g.completed).length
  const totalCount = displayGoals.length

  return (
    <div className="bg-white rounded-xl p-6" style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-black" style={{ letterSpacing: '-0.01em' }}>
          Month Goal's
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 font-medium">{completedCount}/{totalCount}</span>
          <button 
            onClick={onEdit}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {displayGoals.map((goal) => (
          <div 
            key={goal.id}
            className="flex items-center gap-3 cursor-pointer hover:bg-gray-200 rounded-lg p-2 -mx-2 transition-colors"
            onClick={() => onToggleGoal?.(goal.id)}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              goal.completed 
                ? 'bg-black border-black' 
                : 'bg-white border-gray-300'
            }`}>
              {goal.completed && (
                <CheckIcon className="w-3 h-3 text-white" />
              )}
            </div>
            <span className={`text-sm flex-1 ${
              goal.completed 
                ? 'text-gray-500 line-through' 
                : 'text-gray-900'
            }`}>
              {goal.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

