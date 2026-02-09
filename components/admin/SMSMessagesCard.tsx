'use client'

import { useEffect, useState } from 'react'
import { PhoneIcon, CheckIcon, XIcon, AlertCircleIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface SMSMessage {
  id: string
  phone: string
  message: string
  status: 'sent' | 'failed' | 'pending' | 'delivered'
  createdAt: string
  clientName?: string
}

interface SMSMessagesCardProps {
  businessId: string
}

export function SMSMessagesCard({ businessId }: SMSMessagesCardProps) {
  const [messages, setMessages] = useState<SMSMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (businessId) {
      loadMessages()
      const interval = setInterval(loadMessages, 120_000) // 2 хв — економія compute (Neon sleep)
      return () => clearInterval(interval)
    }
  }, [businessId])

  const loadMessages = async () => {
    try {
      const response = await fetch(`/api/sms/messages?businessId=${businessId}&limit=5`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (error) {
      console.error('Error loading SMS messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <CheckIcon className="w-3 h-3 text-green-500" />
      case 'failed':
        return <XIcon className="w-3 h-3 text-red-500" />
      case 'pending':
        return <AlertCircleIcon className="w-3 h-3 text-yellow-500" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      case 'failed':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      case 'pending':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      default:
        return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }
  }

  return (
    <div className="card-candy p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <PhoneIcon className="w-4 h-4 text-candy-blue" />
          <h3 className="text-xs font-black text-gray-900 dark:text-white">SMS Повідомлення</h3>
        </div>
        {unreadCount > 0 && (
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-gradient-to-r from-candy-pink to-red-500 text-white">
            {unreadCount}
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-candy-blue"></div>
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-[10px] text-gray-600 dark:text-gray-400">
            Немає SMS повідомлень
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "p-2 rounded-candy-xs text-xs border",
                getStatusColor(msg.status)
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white truncate">
                    {msg.clientName || msg.phone}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    {format(new Date(msg.createdAt), 'HH:mm')}
                  </p>
                </div>
                {getStatusIcon(msg.status)}
              </div>
              <p className="text-[10px] text-gray-700 dark:text-gray-300 line-clamp-2">
                {msg.message}
              </p>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => window.location.href = '/dashboard/social'}
        className="w-full mt-2 px-2 py-1 bg-gradient-to-r from-candy-blue to-candy-purple text-white font-bold rounded-candy-xs text-[10px] shadow-soft-lg hover:shadow-soft-xl transition-all active:scale-95"
      >
        Всі повідомлення
      </button>
    </div>
  )
}

