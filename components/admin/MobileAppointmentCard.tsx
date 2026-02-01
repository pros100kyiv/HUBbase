'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ClockIcon, CheckIcon, XIcon, UserIcon, EditIcon, MoneyIcon } from '@/components/icons'

interface Appointment {
  id: string
  masterId: string
  masterName?: string
  clientName: string
  clientPhone: string
  startTime: string
  endTime: string
  status: string
  services?: string
  customPrice?: number | null
}

interface MobileAppointmentCardProps {
  appointment: Appointment
  onStatusChange?: (id: string, status: string) => void
  onPriceChange?: (id: string, price: number | null) => void
  servicesCache?: any[]
}

export function MobileAppointmentCard({
  appointment,
  onStatusChange,
  onPriceChange,
  servicesCache = [],
}: MobileAppointmentCardProps) {
  const [isEditingPrice, setIsEditingPrice] = useState(false)
  const [priceValue, setPriceValue] = useState(
    appointment.customPrice ? (appointment.customPrice / 100).toFixed(2) : ''
  )
  const [isSavingPrice, setIsSavingPrice] = useState(false)

  useEffect(() => {
    setPriceValue(appointment.customPrice ? (appointment.customPrice / 100).toFixed(2) : '')
  }, [appointment.customPrice])

  const startTime = new Date(appointment.startTime)
  const endTime = new Date(appointment.endTime)

  // Розраховуємо стандартну ціну з послуг
  const calculateStandardPrice = () => {
    let total = 0
    try {
      if (appointment.services) {
        const parsed = JSON.parse(appointment.services)
        const serviceIds = Array.isArray(parsed) ? parsed : (parsed.serviceIds || [])
        serviceIds.forEach((id: string) => {
          const service = servicesCache.find((s: any) => s.id === id)
          if (service) {
            total += service.price
          }
        })
      }
    } catch (e) {
      // Ignore
    }
    return total
  }

  const standardPrice = calculateStandardPrice()
  const displayPrice = appointment.customPrice ? appointment.customPrice / 100 : standardPrice / 100

  const handleSavePrice = async () => {
    if (!onPriceChange) return
    
    setIsSavingPrice(true)
    try {
      const priceInCents = priceValue ? Math.round(parseFloat(priceValue) * 100) : null
      await onPriceChange(appointment.id, priceInCents)
      setIsEditingPrice(false)
    } catch (error) {
      console.error('Error saving price:', error)
    } finally {
      setIsSavingPrice(false)
    }
  }

  const handleCancelPriceEdit = () => {
    setPriceValue(appointment.customPrice ? (appointment.customPrice / 100).toFixed(2) : '')
    setIsEditingPrice(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
      case 'Очікує':
        return 'text-candy-orange border-candy-orange bg-candy-orange/10 dark:bg-candy-orange/20'
      case 'Confirmed':
      case 'Підтверджено':
        return 'text-candy-mint border-candy-mint bg-candy-mint/10 dark:bg-candy-mint/20'
      case 'Arrived':
      case 'Прибув':
        return 'text-blue-600 dark:text-blue-400 border-blue-500 bg-blue-50 dark:bg-blue-900/30'
      case 'InProgress':
      case 'В роботі':
        return 'text-yellow-600 dark:text-yellow-400 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30'
      case 'Done':
      case 'Виконано':
      case 'Закінчили':
        return 'text-candy-blue border-candy-blue bg-candy-blue/10 dark:bg-candy-blue/20'
      case 'Cancelled':
      case 'Скасовано':
        return 'text-red-600 dark:text-red-400 border-red-500 bg-red-50 dark:bg-red-900/30'
      default:
        return 'text-gray-600 dark:text-gray-400 border-gray-400 bg-gray-50 dark:bg-gray-700'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'Очікує'
      case 'Confirmed':
        return 'Підтверджено'
      case 'Arrived':
        return 'Прибув'
      case 'InProgress':
        return 'В роботі'
      case 'Done':
        return 'Виконано'
      case 'Cancelled':
        return 'Скасовано'
      default:
        return status
    }
  }

  let servicesList: string[] = []
  let serviceNames: string[] = []
  let customService: string | null = null
  
  try {
    if (appointment.services) {
      const parsed = JSON.parse(appointment.services)
      if (Array.isArray(parsed)) {
        // Старий формат - просто масив ID
        servicesList = parsed
      } else if (typeof parsed === 'object' && parsed.serviceIds) {
        // Новий формат з кастомною послугою
        servicesList = parsed.serviceIds || []
        customService = parsed.customService || null
      }
    }
  } catch (e) {
    // Ignore
  }
  
  // Отримуємо назви послуг
  serviceNames = servicesList
    .map((id: string) => {
      const service = servicesCache.find((s: any) => s.id === id)
      return service ? service.name : null
    })
    .filter((name: string | null) => name !== null) as string[]

  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case 'Pending':
      case 'Очікує':
        return 'border-l-4 border-candy-orange'
      case 'Confirmed':
      case 'Підтверджено':
        return 'border-l-4 border-candy-mint'
      case 'Arrived':
      case 'Прибув':
        return 'border-l-4 border-blue-500'
      case 'InProgress':
      case 'В роботі':
        return 'border-l-4 border-yellow-500'
      case 'Done':
      case 'Виконано':
      case 'Закінчили':
        return 'border-l-4 border-candy-blue'
      case 'Cancelled':
      case 'Скасовано':
        return 'border-l-4 border-red-500'
      default:
        return 'border-l-4 border-gray-400'
    }
  }

  return (
    <div className={cn("card-candy card-candy-hover p-2.5 overflow-hidden", getStatusBorderColor(appointment.status))}>
      {/* Header with time and status */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-candy-sm candy-blue flex flex-col items-center justify-center shadow-soft text-white flex-shrink-0 overflow-hidden">
            <span className="text-sm font-black leading-tight">
              {format(startTime, 'HH:mm')}
            </span>
            <span className="text-[10px] font-bold leading-tight">
              {format(startTime, 'dd.MM')}
            </span>
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="font-black text-gray-900 dark:text-white text-sm mb-0.5 truncate">{appointment.clientName}</p>
            <p className="text-xs text-gray-700 dark:text-gray-300 font-semibold mb-0.5 truncate">{appointment.clientPhone}</p>
            {appointment.masterName && (
              <div className="flex items-center gap-1 min-w-0">
                <UserIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                <p className="text-[10px] text-gray-600 dark:text-gray-400 font-semibold truncate min-w-0">
                  {appointment.masterName}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
              getStatusColor(appointment.status)
            )}
          >
            {getStatusLabel(appointment.status)}
          </span>
          {onStatusChange && (
            <div className="flex gap-1 flex-wrap justify-end">
              {appointment.status === 'Pending' && (
                <button
                  onClick={() => onStatusChange(appointment.id, 'Confirmed')}
                  className="px-2 py-1 rounded-candy-xs border border-candy-mint text-candy-mint hover:bg-candy-mint hover:text-white transition-all duration-200 active:scale-95 flex items-center justify-center flex-shrink-0 text-[10px] font-bold whitespace-nowrap"
                  title="Підтвердити"
                >
                  Підтвердити
                </button>
              )}
              {appointment.status === 'Confirmed' && (
                <button
                  onClick={() => onStatusChange(appointment.id, 'Arrived')}
                  className="px-2 py-1 rounded-candy-xs border border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white transition-all duration-200 active:scale-95 flex items-center justify-center flex-shrink-0 text-[10px] font-bold whitespace-nowrap"
                  title="Прибув"
                >
                  Прибув
                </button>
              )}
              {appointment.status === 'Arrived' && (
                <button
                  onClick={() => onStatusChange(appointment.id, 'InProgress')}
                  className="px-2 py-1 rounded-candy-xs border border-yellow-500 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500 hover:text-white transition-all duration-200 active:scale-95 flex items-center justify-center flex-shrink-0 text-[10px] font-bold whitespace-nowrap"
                  title="В роботі"
                >
                  В роботі
                </button>
              )}
              {(appointment.status === 'InProgress' || appointment.status === 'Arrived') && (
                <button
                  onClick={() => onStatusChange(appointment.id, 'Done')}
                  className="px-2 py-1 rounded-candy-xs border border-candy-blue text-candy-blue hover:bg-candy-blue hover:text-white transition-all duration-200 active:scale-95 flex items-center justify-center flex-shrink-0 text-[10px] font-bold whitespace-nowrap"
                  title="Закінчили"
                >
                  Закінчили
                </button>
              )}
              {appointment.status !== 'Cancelled' && appointment.status !== 'Done' && (
                <button
                  onClick={() => onStatusChange(appointment.id, 'Cancelled')}
                  className="px-2 py-1 rounded-candy-xs border border-red-500 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white transition-all duration-200 active:scale-95 flex items-center justify-center flex-shrink-0 text-[10px] font-bold whitespace-nowrap"
                  title="Скасувати"
                >
                  Скасувати
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Services and Time */}
      {(serviceNames.length > 0 || customService) && (
        <div className="flex items-center justify-between gap-1.5 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
            <span className="text-[9px] text-gray-600 dark:text-gray-400 font-bold uppercase flex-shrink-0">Послуги:</span>
            <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
              {serviceNames.length > 0 && (
                <>
                  {serviceNames.map((name, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-[9px] font-bold text-gray-900 dark:text-gray-100 truncate max-w-[120px]"
                      title={name}
                    >
                      {name}
                    </span>
                  ))}
                </>
              )}
              {customService && (
                <span
                  className="px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-600 text-[9px] font-bold text-blue-700 dark:text-blue-300 italic truncate max-w-[120px]"
                  title={customService}
                >
                  {customService}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <ClockIcon className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">
              {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
            </span>
            <span className="text-[9px] text-gray-500 dark:text-gray-500">•</span>
            <span className="text-[10px] text-gray-600 dark:text-gray-400 font-semibold">
              {Math.round((endTime.getTime() - startTime.getTime()) / 60000)} хв
            </span>
          </div>
        </div>
      )}

      {/* Price Section */}
      <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <MoneyIcon className="w-3.5 h-3.5 text-candy-blue flex-shrink-0" />
          {isEditingPrice ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                value={priceValue}
                onChange={(e) => setPriceValue(e.target.value)}
                placeholder="Ціна в грн"
                min="0"
                step="0.01"
                className="flex-1 px-2 py-1 text-xs rounded-candy-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground"
                autoFocus
              />
              <button
                onClick={handleSavePrice}
                disabled={isSavingPrice}
                className="p-1 rounded-candy-xs bg-candy-blue text-white hover:bg-candy-blue/80 transition-colors disabled:opacity-50"
                title="Зберегти"
              >
                <CheckIcon className="w-3 h-3" />
              </button>
              <button
                onClick={handleCancelPriceEdit}
                disabled={isSavingPrice}
                className="p-1 rounded-candy-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                title="Скасувати"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <>
              <span className="text-[10px] text-gray-600 dark:text-gray-400 font-bold uppercase flex-shrink-0">Ціна:</span>
              <span className={cn(
                "text-sm font-black",
                appointment.customPrice ? "text-candy-blue" : "text-gray-900 dark:text-white"
              )}>
                {new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(displayPrice)}
              </span>
              {appointment.customPrice && (
                <span className="text-[9px] text-gray-500 dark:text-gray-400 italic">
                  (індивідуальна)
                </span>
              )}
              {onPriceChange && (
                <button
                  onClick={() => setIsEditingPrice(true)}
                  className="p-1 rounded-candy-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-auto"
                  title="Редагувати ціну"
                >
                  <EditIcon className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

