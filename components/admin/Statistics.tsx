'use client'

import { useEffect, useState } from 'react'
import { MobileWidget } from './MobileWidget'
import { CalendarIcon, CheckIcon, XIcon, UsersIcon, MoneyIcon } from '@/components/icons'

interface StatisticsProps {
  businessId: string
}

interface Stats {
  period: string
  totalAppointments: number
  confirmedAppointments: number
  completedAppointments: number
  cancelledAppointments: number
  uniqueClients: number
  totalRevenue: number
  serviceStats: Record<string, number>
  masterStats: Array<{ masterId: string; count: number }>
}

export function Statistics({ businessId }: StatisticsProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/statistics?businessId=${businessId}&period=${period}`)
      .then((res) => res.json())
      .then((data) => {
        setStats(data)
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error loading statistics:', error)
        setLoading(false)
      })
  }, [businessId, period])

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">Завантаження статистики...</p>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100)
  }

  return (
    <div className="space-y-1.5 card-candy card-candy-hover rounded-candy shadow-soft p-2.5 md:p-3">
      {/* Period Selector */}
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="text-sm md:text-base font-black text-foreground">Статистика</h2>
        <div className="flex gap-2 bg-gray-100 dark:bg-gray-700 p-1.5 rounded-candy border border-gray-200 dark:border-gray-600">
          <button
            onClick={() => setPeriod('day')}
            className={`px-5 py-2.5 rounded-candy text-sm font-bold transition-all duration-200 active:scale-97 ${
              period === 'day'
                ? 'candy-purple text-white shadow-soft-lg'
                : 'text-gray-600 dark:text-gray-300 hover:text-candy-blue dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-700'
            }`}
          >
            День
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-5 py-2.5 rounded-candy text-sm font-bold transition-all duration-200 active:scale-97 ${
              period === 'week'
                ? 'candy-purple text-white shadow-soft-lg'
                : 'text-gray-600 dark:text-gray-300 hover:text-candy-blue dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-700'
            }`}
          >
            Тиждень
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-5 py-2.5 rounded-candy text-sm font-bold transition-all duration-200 active:scale-97 ${
              period === 'month'
                ? 'candy-purple text-white shadow-soft-lg'
                : 'text-gray-600 dark:text-gray-300 hover:text-candy-blue dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-700'
            }`}
          >
            Місяць
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-1.5">
        <MobileWidget
          icon={<CalendarIcon />}
          title="Всього записів"
          value={stats.totalAppointments}
          iconColor="orange"
        />
        <MobileWidget
          icon={<CheckIcon />}
          title="Підтверджено"
          value={stats.confirmedAppointments}
          trend="up"
          iconColor="green"
        />
        <MobileWidget
          icon={<CheckIcon />}
          title="Виконано"
          value={stats.completedAppointments}
          trend="up"
          iconColor="green"
        />
        <MobileWidget
          icon={<XIcon />}
          title="Скасовано"
          value={stats.cancelledAppointments}
          trend="down"
          iconColor="pink"
        />
        <MobileWidget
          icon={<UsersIcon />}
          title="Клієнти"
          value={stats.uniqueClients}
          iconColor="blue"
        />
        <MobileWidget
          icon={<MoneyIcon />}
          title="Дохід"
          value={formatCurrency(stats.totalRevenue)}
          iconColor="blue"
        />
      </div>
    </div>
  )
}

