'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ModalPortal } from '@/components/ui/modal-portal'
import { XIcon, ChartIcon, CheckIcon, UsersIcon, MoneyIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

interface MonthProgressCardProps {
  stats?: {
    totalAppointments: number
    confirmedAppointments: number
    completedAppointments: number
    cancelledAppointments: number
    totalRevenue: number
    uniqueClients: number
  } | null
  loading?: boolean
}

export function MonthProgressCard({ stats, loading }: MonthProgressCardProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)

  // Якщо дані завантажуються або відсутні
  if (loading || !stats) {
    return (
      <div className="rounded-xl p-4 md:p-6 card-glass animate-pulse h-[200px]">
        <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-white/10 rounded w-1/2 mb-8"></div>
        <div className="flex gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-white/10 rounded w-full"></div>
            <div className="h-3 bg-white/10 rounded w-full"></div>
            <div className="h-3 bg-white/10 rounded w-full"></div>
          </div>
          <div className="w-24 h-24 bg-white/10 rounded-full"></div>
        </div>
      </div>
    )
  }

  // Розрахунки для графіку
  const total = stats.totalAppointments || 1 // щоб не ділити на 0
  const completed = stats.completedAppointments || 0
  const confirmed = stats.confirmedAppointments || 0
  const cancelled = stats.cancelledAppointments || 0
  
  // Відсоток успішності (виконані + підтверджені)
  const successRate = Math.round(((completed + confirmed) / total) * 100)
  
  const overview = [
    { label: 'Виконано', value: completed, color: 'bg-green-400', textColor: 'text-green-400' },
    { label: 'Підтверджено', value: confirmed, color: 'bg-blue-400', textColor: 'text-blue-400' },
    { label: 'Скасовано', value: cancelled, color: 'bg-red-400', textColor: 'text-red-400' },
  ]

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(amount))
  }

  const radius = 28
  const circumference = 2 * Math.PI * radius
  const dashArray = `${(successRate / 100) * circumference} ${circumference}`

  return (
    <>
      <div className="dashboard-card hover:border-white/20 transition-all duration-200 cursor-pointer group" onClick={() => setShowModal(true)}>
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="dashboard-card-title">
            Прогрес місяця
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation()
              router.push('/dashboard/analytics')
            }}
            className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg transition-colors hidden md:flex opacity-80 group-hover:opacity-100"
            title="Повна аналітика"
          >
            <ChartIcon className="w-4 h-4 md:w-5 md:h-5 text-gray-300" />
          </button>
        </div>

        <p className="text-xs md:text-sm text-gray-400 mb-4">
          <span className="font-semibold text-white">{successRate}%</span> записів успішні
        </p>

        <div className="flex items-start gap-4 md:gap-5 mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase mb-2 tracking-wide">
              Огляд
            </p>
            <div className="space-y-2">
              {overview.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0 ring-2 ring-white/10', item.color)} />
                    <span className="text-xs md:text-sm text-gray-300 truncate">{item.label}</span>
                  </div>
                  <span className={cn('text-xs md:text-sm font-semibold tabular-nums', item.textColor)}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex-shrink-0" style={{ width: '4.5rem', height: '4.5rem' }}>
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
              <defs>
                <linearGradient id="month-progress-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="1" />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity="0.9" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                stroke="url(#month-progress-ring)"
                strokeWidth="5"
                strokeDasharray={dashArray}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-base md:text-lg font-bold text-white tabular-nums">{stats.totalAppointments}</span>
              <span className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-wide">всього</span>
            </div>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowModal(true)
          }}
          className="w-full dashboard-btn-secondary text-center"
        >
          Детальніше
        </button>
      </div>

      {/* Модальне вікно з деталями */}
      {showModal && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => setShowModal(false)}>
            <div className="relative w-[95%] sm:w-full sm:max-w-md sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="modal-close text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30 rounded-xl"
                aria-label="Закрити"
              >
                <XIcon className="w-5 h-5" />
              </button>
              <div className="pr-10 mb-6">
                <h2 className="modal-title">Статистика місяця</h2>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 text-gray-400 mb-2">
                    <CheckIcon className="w-4 h-4 text-green-400" />
                    <span className="text-xs font-medium">Успішність</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{successRate}%</div>
                  <div className="text-xs text-gray-500 mt-1">Виконано + Підтверджено</div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 text-gray-400 mb-2">
                    <MoneyIcon className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-medium">Дохід</span>
                  </div>
                  <div className="text-xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</div>
                  <div className="text-xs text-gray-500 mt-1">За поточний місяць</div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Деталі записів</h3>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckIcon className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Виконано</div>
                      <div className="text-xs text-gray-400">Успішно завершені</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{completed}</div>
                    <div className="text-xs text-gray-400">{Math.round((completed/total)*100)}%</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <CheckIcon className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Підтверджено</div>
                      <div className="text-xs text-gray-400">Очікують виконання</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{confirmed}</div>
                    <div className="text-xs text-gray-400">{Math.round((confirmed/total)*100)}%</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                      <XIcon className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Скасовано</div>
                      <div className="text-xs text-gray-400">Відмінені записи</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{cancelled}</div>
                    <div className="text-xs text-gray-400">{Math.round((cancelled/total)*100)}%</div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                   <div className="flex items-center gap-2 text-gray-400">
                      <UsersIcon className="w-4 h-4" />
                      <span className="text-xs">Унікальні клієнти</span>
                   </div>
                   <span className="font-bold">{stats.uniqueClients}</span>
                </div>
                <button 
                  onClick={() => router.push('/dashboard/analytics')}
                  className="w-full mt-4 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Перейти до повної аналітики
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  )
}
