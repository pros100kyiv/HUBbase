'use client'

import { UserIcon } from '@/components/icons'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface UpcomingAppointmentTask {
  id: string
  clientName: string
  masterName?: string
  time: string
  status?: string
}

interface TasksInProcessCardProps {
  tasks: UpcomingAppointmentTask[]
  onAddNote?: (taskId: string) => void
  onEdit?: (taskId: string) => void
  onDelete?: (taskId: string) => void
}

export function TasksInProcessCard({ tasks, onAddNote, onEdit, onDelete }: TasksInProcessCardProps) {
  const router = useRouter()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const displayTasks = tasks || []

  return (
    <div className="rounded-xl p-4 md:p-6 card-floating">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="text-base md:text-lg font-semibold text-white" style={{ letterSpacing: '-0.01em' }}>
          Найближчі записи ({displayTasks.length})
        </h3>
        <button
          onClick={() => router.push('/dashboard/appointments')}
          className="text-xs md:text-sm text-gray-300 hover:text-white transition-colors hidden md:block"
        >
          Всі записи →
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:gap-3">
        {displayTasks.map((task) => (
          <div
            key={task.id}
            className="bg-white/5 rounded-lg p-3 md:p-4 relative border border-white/10 cursor-pointer hover:bg-white/[0.07] transition-colors"
            onClick={() => onEdit?.(task.id)}
          >
            <div className="flex items-start justify-between mb-2 md:mb-3">
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <UserIcon className="w-4 h-4 md:w-5 md:h-5 text-gray-300" />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenMenuId(openMenuId === task.id ? null : task.id)
                }}
                className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
              >
                <svg className="w-3 h-3 md:w-4 md:h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>

            {openMenuId === task.id && (
              <div className="absolute top-10 md:top-12 right-2 bg-[#2A2A2A] border border-white/20 rounded-lg shadow-lg z-10 min-w-[140px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddNote?.(task.id)
                    setOpenMenuId(null)
                  }}
                  className="w-full text-left px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm text-gray-200 hover:bg-white/10 rounded-t-lg"
                >
                  Додати нотатку
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit?.(task.id)
                    setOpenMenuId(null)
                  }}
                  className="w-full text-left px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm text-gray-200 hover:bg-white/10"
                >
                  Редагувати
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete?.(task.id)
                    setOpenMenuId(null)
                  }}
                  className="w-full text-left px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm text-red-400 hover:bg-white/10 rounded-b-lg"
                >
                  Скасувати
                </button>
              </div>
            )}

            <h4 className="text-xs md:text-sm font-semibold text-white mb-0.5 md:mb-1 line-clamp-2">{task.clientName}</h4>
            {task.masterName && (
              <p className="text-[10px] md:text-xs text-gray-400 mb-0.5 line-clamp-1">{task.masterName}</p>
            )}
            <p className="text-[10px] md:text-xs text-gray-300">{task.time}</p>

            <div className="absolute bottom-1.5 md:bottom-2 right-1.5 md:right-2">
              <svg className="w-3 h-3 md:w-4 md:h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

