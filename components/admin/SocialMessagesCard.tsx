'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface SocialMessage {
  id: string
  platform: 'telegram' | 'instagram' | 'whatsapp' | 'facebook' | 'viber'
  senderName: string
  senderId?: string
  message: string
  timestamp: string
  isRead: boolean
  avatar?: string
}

interface SocialMessagesCardProps {
  businessId: string
}

export function SocialMessagesCard({ businessId }: SocialMessagesCardProps) {
  const [messages, setMessages] = useState<SocialMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMessage, setSelectedMessage] = useState<SocialMessage | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    loadMessages()
    const interval = setInterval(loadMessages, 30000)
    return () => clearInterval(interval)
  }, [businessId])

  const loadMessages = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/social-messages?businessId=${businessId}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data || [])
      }
    } catch (error) {
      console.error('Error loading messages:', error)
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  const handleReply = async () => {
    if (!selectedMessage || !replyText.trim()) return

    try {
      setSending(true)
      const response = await fetch('/api/social-messages/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          messageId: selectedMessage.id,
          platform: selectedMessage.platform,
          reply: replyText.trim(),
        }),
      })

      if (response.ok) {
        setReplyText('')
        setSelectedMessage(null)
        loadMessages()
      }
    } catch (error) {
      console.error('Error sending reply:', error)
    } finally {
      setSending(false)
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'telegram':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.192l-1.87 8.803c-.14.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.053 5.56-5.022c.24-.213-.054-.334-.373-.12l-6.87 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
          </svg>
        )
      case 'instagram':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        )
      case 'whatsapp':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.372a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        )
      case 'facebook':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        )
      case 'viber':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24.009c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z"/>
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )
    }
  }

  const getPlatformShortName = (platform: string) => {
    const names: Record<string, string> = {
      telegram: 'Teleg',
      instagram: 'Insta',
      whatsapp: 'Whats',
      facebook: 'FB',
      viber: 'Viber',
    }
    return names[platform] || platform
  }

  const getPlatformBgColor = (platform: string) => {
    const colors: Record<string, string> = {
      telegram: 'bg-[#0088cc]',
      instagram: 'bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#dc2743]',
      whatsapp: 'bg-[#25D366]',
      facebook: 'bg-[#1877F2]',
      viber: 'bg-[#665CAC]',
    }
    return colors[platform] || 'bg-gray-500'
  }

  const unreadCount = messages.filter(m => !m.isRead).length

  return (
    <div className="rounded-xl p-6 card-floating">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-0.5" style={{ letterSpacing: '-0.01em' }}>
            Повідомлення
          </h3>
          <p className="text-sm text-gray-300 font-normal">З соціальних мереж</p>
        </div>
        {unreadCount > 0 && (
          <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{unreadCount}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="text-sm text-gray-400">Завантаження...</div>
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm text-gray-400 mb-2">Немає повідомлень</p>
          <p className="text-xs text-gray-500">Підключіть соціальні мережі в налаштуваннях</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {messages.map((message) => (
              <button
                key={message.id}
                onClick={() => setSelectedMessage(message)}
                className={cn(
                  'w-full text-left rounded-lg p-3 transition-colors',
                  !message.isRead
                    ? 'bg-white/10 border border-white/20'
                    : 'bg-white/5 border border-white/10 hover:bg-white/8'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Platform Icon */}
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white',
                    getPlatformBgColor(message.platform)
                  )}>
                    {getPlatformIcon(message.platform)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white">
                        {message.senderName}
                      </span>
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/50 rounded text-[10px] font-medium">
                        {getPlatformShortName(message.platform)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 line-clamp-2 mb-1.5">
                      {message.message}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {format(new Date(message.timestamp), 'd MMM, HH:mm', { locale: uk })}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Reply Modal */}
          {selectedMessage && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
              <div className="fixed inset-0 bg-black/70" onClick={() => setSelectedMessage(null)} />
              <div className="relative w-full max-w-md bg-[#2A2A2A] rounded-xl p-6 border border-white/10 my-auto max-h-[calc(100vh-2rem)] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-white',
                      getPlatformBgColor(selectedMessage.platform)
                    )}>
                      {getPlatformIcon(selectedMessage.platform)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{selectedMessage.senderName}</div>
                      <div className="text-xs text-gray-400">{getPlatformShortName(selectedMessage.platform)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedMessage(null)}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Original Message */}
                <div className="bg-white/5 rounded-lg p-3 mb-4">
                  <p className="text-sm text-gray-300">{selectedMessage.message}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {format(new Date(selectedMessage.timestamp), 'd MMMM yyyy, HH:mm', { locale: uk })}
                  </p>
                </div>

                {/* Reply Input */}
                <div className="space-y-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Введіть відповідь..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-gray-400 resize-none focus:outline-none focus:border-white/20"
                    rows={3}
                    style={{ letterSpacing: '-0.01em' }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedMessage(null)}
                      className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors"
                    >
                      Скасувати
                    </button>
                    <button
                      onClick={handleReply}
                      disabled={!replyText.trim() || sending}
                      className="flex-1 px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ letterSpacing: '-0.01em' }}
                    >
                      {sending ? 'Відправка...' : 'Відправити'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
