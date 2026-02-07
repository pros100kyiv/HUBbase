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
      <div className="rounded-xl p-4 md:p-6 card-floating animate-pulse h-[200px]">
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

  // Розрахунок довжини кола для svg (r=26 -> l=2*pi*26 ≈ 163.36)
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const dashArray = `${(successRate / 100) * circumference} ${circumference}`

  return (
    <>
      <div className="rounded-xl p-4 md:p-6 card-floating hover:border-white/20 transition-colors cursor-pointer" onClick={() => setShowModal(true)}>
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="text-base md:text-lg font-semibold text-white" style={{ letterSpacing: '-0.01em' }}>
            Прогрес місяця
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation()
              router.push('/dashboard/analytics')
            }}
            className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg transition-colors hidden md:flex"
            title="Повна аналітика"
          >
            <ChartIcon className="w-4 h-4 md:w-5 md:h-5 text-gray-300" />
          </button>
        </div>

        <p className="text-xs md:text-sm text-gray-300 mb-3 md:mb-4">
          {successRate}% записів успішні
        </p>

        <div className="flex items-start gap-4 md:gap-6 mb-3 md:mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] md:text-xs font-semibold text-gray-400 uppercase mb-1.5 md:mb-2" style={{ letterSpacing: '0.05em' }}>
              ОГЛЯД
            </p>
            <div className="space-y-1.5 md:space-y-2">
              {overview.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <div className={cn("w-1.5 h-1.5 md:w-2 md:h-2 rounded-full flex-shrink-0", item.color)}></div>
                    <span className="text-xs md:text-sm text-gray-300 truncate">{item.label}</span>
                  </div>
                  <span className={cn("text-xs md:text-sm font-semibold", item.textColor)}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Кругова діаграма */}
          <div className="relative w-16 h-16 md:w-24 md:h-24 flex-shrink-0">
            <svg className="w-16 h-16 md:w-24 md:h-24 transform -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r={radius}
                fill="none"
                stroke="#374151" // gray-700
                strokeWidth="5"
              />
              <circle
                cx="50%"
                cy="50%"
                r={radius}
                fill="none"
                stroke="#60A5FA" // blue-400
                strokeWidth="5"
                strokeDasharray={dashArray}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-sm md:text-lg font-bold text-white">{stats.totalAppointments}</span>
              <span className="text-[8px] md:text-[10px] text-gray-400">всього</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowModal(true)
            }}
            className="flex-1 px-3 md:px-4 py-1.5 md:py-2 bg-white/10 border border-white/20 rounded-lg text-xs md:text-sm font-medium text-white hover:bg-white/20 transition-colors active:scale-[0.98]"
          >
            Детальніше
          </button>
        </div>
      </div>

      {/* Модальне вікно з деталями */}
      {showModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full sm:max-w-md bg-[#1A1A1A] border border-white/10 rounded-t-xl sm:rounded-xl p-4 sm:p-6 sm:my-auto max-h-[90vh] sm:max-h-[calc(100vh-2rem)] overflow-y-auto text-white shadow-xl animate-in fade-in zoom-in-95 duration-200">
              
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Статистика місяця</h2>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <XIcon className="w-5 h-5 text-gray-400" />
                </button>
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
