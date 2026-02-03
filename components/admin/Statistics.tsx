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
    }).format(amount)
  }

  return (
    <div className="card-modern card-modern-hover p-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-black" style={{ letterSpacing: '-0.02em' }}>Статистика</h2>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setPeriod('day')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              period === 'day'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-black'
            }`}
          >
            День
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              period === 'week'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-black'
            }`}
          >
            Тиждень
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              period === 'month'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-black'
            }`}
          >
            Місяць
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
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
          iconColor="purple"
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

