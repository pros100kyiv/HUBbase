'use client'

import { UsersIcon, UserIcon } from '@/components/icons'
import { useState } from 'react'

interface Task {
  id: string
  title: string
  time: string
  icon: 'users' | 'user'
}

interface TasksInProcessCardProps {
  tasks: Task[]
  onAddNote?: (taskId: string) => void
  onEdit?: (taskId: string) => void
  onDelete?: (taskId: string) => void
}

export function TasksInProcessCard({ tasks, onAddNote, onEdit, onDelete }: TasksInProcessCardProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const displayTasks = tasks || []

  return (
    <div className="rounded-xl p-6 card-floating">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white" style={{ letterSpacing: '-0.01em' }}>
          Task In process ({displayTasks.length})
        </h3>
        <button className="text-sm text-gray-300 hover:text-white transition-colors">
          Open Archive &gt;
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {displayTasks.map((task) => (
          <div 
            key={task.id}
            className="bg-white/5 rounded-lg p-4 relative border border-white/10"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                {task.icon === 'users' ? (
                  <UsersIcon className="w-5 h-5 text-gray-300" />
                ) : (
                  <UserIcon className="w-5 h-5 text-gray-300" />
                )}
              </div>
              <button
                onClick={() => setOpenMenuId(openMenuId === task.id ? null : task.id)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>

            {openMenuId === task.id && (
              <div className="absolute top-12 right-2 bg-[#2A2A2A] border border-white/20 rounded-lg shadow-lg z-10 min-w-[120px]">
                <button
                  onClick={() => {
                    onAddNote?.(task.id)
                    setOpenMenuId(null)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-white/10 rounded-t-lg"
                >
                  Add Note
                </button>
                <button
                  onClick={() => {
                    onEdit?.(task.id)
                    setOpenMenuId(null)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    onDelete?.(task.id)
                    setOpenMenuId(null)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/10 rounded-b-lg"
                >
                  Delete
                </button>
              </div>
            )}

            <h4 className="text-sm font-semibold text-white mb-1">{task.title}</h4>
            <p className="text-xs text-gray-300">{task.time}</p>
            
            <div className="absolute bottom-2 right-2">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

