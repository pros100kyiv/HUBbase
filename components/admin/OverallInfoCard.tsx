'use client'

import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { useRouter } from 'next/navigation'

interface Task {
  id: string
  title: string
  time: string
  status?: string
  masterName?: string
}

interface OverallInfoCardProps {
  tasks?: Task[]
  onBookAppointment?: () => void
}

export function OverallInfoCard({ tasks = [], onBookAppointment }: OverallInfoCardProps) {
  const router = useRouter()
  const hasTasks = tasks && tasks.length > 0

  const handleBookAppointment = () => {
    if (onBookAppointment) {
      onBookAppointment()
    } else {
      router.push('/dashboard/appointments?create=true')
    }
  }

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

      {hasTasks ? (
        /* Tasks List - адаптивний вміст */
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-white/5 border border-white/10 rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white mb-1" style={{ letterSpacing: '-0.01em' }}>
                    {task.title}
                  </h4>
                  {task.masterName && (
                    <p className="text-xs text-gray-400 mb-2">{task.masterName}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-300">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {task.time}
                  </div>
                </div>
                {task.status && (
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    task.status === 'Confirmed' || task.status === 'Підтверджено'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                      : task.status === 'Pending' || task.status === 'Очікує'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                      : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
                  }`}>
                    {task.status}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center">
          {/* Illustration */}
          <div className="mb-6 flex justify-center">
            <div className="relative w-56 h-40">
              {/* Background shape - less bright */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 to-blue-400/10 rounded-3xl blur-2xl"></div>
              
              {/* Central element - Calendar/Notebook */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="relative">
                  {/* Notebook/Calendar base */}
                  <div className="w-24 h-32 bg-gradient-to-br from-purple-500/15 to-purple-600/15 rounded-lg border-2 border-purple-400/20 shadow-lg">
                    {/* Spiral binding */}
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-purple-400/20 rounded-l-lg"></div>
                    {/* Lines on page */}
                    <div className="absolute inset-2 left-4 flex flex-col gap-1.5">
                      <div className="h-0.5 bg-purple-300/15 rounded w-full"></div>
                      <div className="h-0.5 bg-purple-300/15 rounded w-3/4"></div>
                      <div className="h-0.5 bg-purple-300/15 rounded w-full"></div>
                      <div className="h-0.5 bg-purple-300/15 rounded w-2/3"></div>
                      <div className="h-0.5 bg-purple-300/15 rounded w-full"></div>
                    </div>
                    {/* Checkbox circles */}
                    <div className="absolute right-3 top-4 flex flex-col gap-2">
                      <div className="w-3 h-3 rounded-full border border-purple-300/20"></div>
                      <div className="w-3 h-3 rounded-full border border-purple-300/20"></div>
                      <div className="w-3 h-3 rounded-full border border-purple-300/20"></div>
                    </div>
                  </div>
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

          {/* Text with updated fonts */}
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm font-medium text-white" style={{ letterSpacing: '-0.01em' }}>Сьогодні без завдань</span>
                <span className="ml-2 text-yellow-400/70">🔄</span>
              </div>
            </div>
            
            <div className="px-4 py-2 bg-white/5 rounded-lg inline-block border border-white/10">
              <p className="text-sm text-gray-300 font-normal" style={{ letterSpacing: '-0.01em' }}>
                Можеш використати момент і додати справи на день
              </p>
            </div>

            {/* Book Appointment Button */}
            <button
              onClick={handleBookAppointment}
              className="mt-4 px-6 py-3 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
              style={{ letterSpacing: '-0.01em', boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
            >
              Записати на послугу
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

