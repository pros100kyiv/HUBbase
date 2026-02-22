'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ModalPortal } from '@/components/ui/modal-portal'

interface SocialChat {
  platform: string
  externalChatId: string
  senderName: string
  senderId?: string
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
  firstInboundId: string
}

interface ThreadMessage {
  id: string
  platform: string
  direction: 'inbound' | 'outbound'
  senderName: string
  senderId?: string
  message: string
  timestamp: string
  isRead: boolean
}

interface SocialMessagesCardProps {
  businessId: string
  /** Якщо задано, автоматично відкрити цей чат при завантаженні */
  initialOpenChat?: { platform: string; externalChatId: string } | null
}

const HIDDEN_CHATS_KEY = (bid: string) => `xbase_hidden_chats_${bid}`

function getHiddenChats(businessId: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HIDDEN_CHATS_KEY(businessId))
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function setHiddenChats(businessId: string, keys: string[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(HIDDEN_CHATS_KEY(businessId), JSON.stringify(keys))
  } catch {}
}

export function SocialMessagesCard({ businessId, initialOpenChat }: SocialMessagesCardProps) {
  const [chats, setChats] = useState<SocialChat[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(true)
  const [selectedChat, setSelectedChat] = useState<SocialChat | null>(null)
  const [thread, setThread] = useState<ThreadMessage[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [hiddenChats, setHiddenChatsState] = useState<string[]>(() => getHiddenChats(businessId))
  const [firstInboundIdFromThread, setFirstInboundIdFromThread] = useState<string>('')

  const visibleChats = chats.filter((c) => !hiddenChats.includes(`${c.platform}::${c.externalChatId}`))
  const hasUnread = chats.some((c) => c.unreadCount > 0)
  const unreadTotal = chats.reduce((sum, c) => sum + c.unreadCount, 0)
  const pollIntervalMs = hasUnread || !collapsed ? 20_000 : 120_000

  useEffect(() => {
    loadChats(false)
    setHiddenChatsState(getHiddenChats(businessId))
  }, [businessId])

  useEffect(() => {
    if (!collapsed) loadChats(true)
  }, [collapsed])

  useEffect(() => {
    const interval = setInterval(() => loadChats(true), pollIntervalMs)
    return () => clearInterval(interval)
  }, [businessId, pollIntervalMs])

  useEffect(() => {
    if (selectedChat) {
      setFirstInboundIdFromThread('')
      loadThread(selectedChat)
      markChatRead(selectedChat)
    } else {
      setThread([])
      setFirstInboundIdFromThread('')
    }
  }, [selectedChat?.externalChatId, selectedChat?.platform])

  // Відкрити чат з URL/initialOpenChat (наприклад з картки клієнта)
  useEffect(() => {
    if (!initialOpenChat || !businessId) return
    const match = chats.find(
      (c) => c.platform === initialOpenChat.platform && c.externalChatId === initialOpenChat.externalChatId
    )
    if (match) {
      if (!selectedChat || selectedChat.externalChatId !== match.externalChatId) {
        setSelectedChat(match)
        setCollapsed(false)
      }
    } else if (!selectedChat) {
      // Чат може ще не бути в списку — відкриваємо з мінімальними даними
      const virtualChat: SocialChat = {
        platform: initialOpenChat.platform,
        externalChatId: initialOpenChat.externalChatId,
        senderName: 'Клієнт',
        lastMessage: '',
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
        firstInboundId: '',
      }
      setSelectedChat(virtualChat)
      setCollapsed(false)
    }
  }, [initialOpenChat, businessId, chats])

  const loadChats = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const response = await fetch(`/api/social-messages?businessId=${businessId}&mode=chats`)
      if (response.ok) {
        const data = await response.json()
        setChats(data || [])
      }
    } catch (error) {
      console.error('Error loading chats:', error)
      setChats([])
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const loadThread = async (chat: SocialChat) => {
    setThreadLoading(true)
    try {
      const response = await fetch(
        `/api/social-messages?businessId=${businessId}&chatId=${encodeURIComponent(chat.externalChatId)}&platform=${encodeURIComponent(chat.platform)}`
      )
      if (response.ok) {
        const data = await response.json()
        setThread(data || [])
      }
    } catch (error) {
      console.error('Error loading thread:', error)
      setThread([])
    } finally {
      setThreadLoading(false)
    }
  }

  const markChatRead = (chat: SocialChat) => {
    if (chat.unreadCount === 0) return
    fetch(
      `/api/social-messages?businessId=${businessId}&chatId=${encodeURIComponent(chat.externalChatId)}&platform=${encodeURIComponent(chat.platform)}`,
      { method: 'PATCH' }
    )
      .then(() => {
        setChats((prev) =>
          prev.map((c) =>
            c.externalChatId === chat.externalChatId && c.platform === chat.platform
              ? { ...c, unreadCount: 0 }
              : c
          )
        )
      })
      .catch(() => {})
  }

  const handleReply = async () => {
    if (!selectedChat || !replyText.trim()) return
    const inboundId = selectedChat.firstInboundId || firstInboundIdFromThread
    if (!inboundId) {
      setReplyError('Неможливо відповісти в цей чат')
      return
    }
    setReplyError(null)
    try {
      setSending(true)
      const response = await fetch('/api/social-messages/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          messageId: selectedChat.firstInboundId,
          platform: selectedChat.platform,
          reply: replyText.trim(),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data.success !== false) {
        setReplyText('')
        loadThread(selectedChat)
        loadChats(true)
      } else {
        setReplyError(data.error || data.details || 'Не вдалося відправити. Спробуйте ще раз.')
      }
    } catch (error) {
      console.error('Error sending reply:', error)
      setReplyError('Помилка з\'єднання. Спробуйте ще раз.')
    } finally {
      setSending(false)
    }
  }

  const handleHideChat = (chat: SocialChat) => {
    const key = `${chat.platform}::${chat.externalChatId}`
    const next = [...hiddenChats, key]
    setHiddenChatsState(next)
    setHiddenChats(businessId, next)
    setSelectedChat(null)
    setChats((prev) => prev.filter((c) => `${c.platform}::${c.externalChatId}` !== key))
  }

  const handleDeleteChat = async (chat: SocialChat) => {
    if (!window.confirm('Видалити всю переписку з цим чатом? Цю дію неможливо скасувати.')) return
    try {
      const res = await fetch(
        `/api/social-messages?businessId=${businessId}&chatId=${encodeURIComponent(chat.externalChatId)}&platform=${encodeURIComponent(chat.platform)}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        handleHideChat(chat)
        loadChats(true)
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Не вдалося видалити')
      }
    } catch (e) {
      alert('Помилка з\'єднання')
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

  const hasAny = visibleChats.length > 0
  const latest = visibleChats[0]

  return (
    <div className="rounded-xl p-4 md:p-6 card-glass-subtle min-w-0 w-full max-w-full overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className={cn(
          'w-full flex items-start justify-between gap-3 text-left rounded-lg transition-colors',
          collapsed ? 'hover:bg-white/5 -m-2 p-2' : ''
        )}
        aria-expanded={!collapsed}
      >
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-base md:text-xl font-bold text-white truncate" style={{ letterSpacing: '-0.01em' }}>
              Повідомлення
            </h3>
            {hasUnread && (
              <div className="w-5 h-5 md:w-6 md:h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] md:text-xs font-bold text-white">{unreadTotal}</span>
              </div>
            )}
            {!hasUnread && hasAny && (
              <span className="text-[10px] md:text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-gray-300 flex-shrink-0">
                є
              </span>
            )}
          </div>
          <p className="text-xs md:text-sm text-gray-300 font-normal break-words min-w-0">
            {collapsed
              ? loading
                ? 'Перевіряю…'
                : hasUnread
                  ? 'Є нові повідомлення'
                  : hasAny
                    ? 'Є переписки'
                    : 'Немає повідомлень'
              : 'З соціальних мереж'}
          </p>
          {collapsed && !loading && latest && (
            <p className="text-[10px] md:text-xs text-gray-400 mt-1 line-clamp-1 break-words min-w-0" title={`${latest.senderName}: ${latest.lastMessage}`}>
              {latest.senderName}: {latest.lastMessage}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 pt-1">
          <svg
            className={cn('w-5 h-5 text-gray-300 transition-transform', collapsed ? '' : 'rotate-180')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {collapsed ? null : loading ? (
        <div className="text-center py-8">
          <div className="text-sm text-gray-400">Завантаження...</div>
        </div>
      ) : visibleChats.length === 0 ? (
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm text-gray-400 mb-2">Немає повідомлень</p>
          <p className="text-xs text-gray-500">Налаштування → Telegram: підключіть бота та налаштуйте webhook, щоб отримувати повідомлення тут</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 md:space-y-3 max-h-[300px] md:max-h-[400px] overflow-y-auto pr-1">
            {visibleChats.map((chat) => (
              <button
                key={`${chat.platform}::${chat.externalChatId}`}
                onClick={() => {
                  setSelectedChat(chat)
                  setReplyError(null)
                }}
                className={cn(
                  'w-full text-left rounded-lg p-3 md:p-3 transition-colors active:scale-[0.98] touch-manipulation min-h-[64px]',
                  chat.unreadCount > 0
                    ? 'bg-white/10 border border-white/20'
                    : 'bg-white/5 border border-white/10 hover:bg-white/8'
                )}
              >
                <div className="flex items-start gap-2 md:gap-3">
                  <div className={cn(
                    'w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white',
                    getPlatformBgColor(chat.platform)
                  )}>
                    {getPlatformIcon(chat.platform)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1 flex-wrap">
                      <span className="text-xs md:text-sm font-bold text-white truncate">
                        {chat.senderName}
                      </span>
                      <span className="px-1.5 md:px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/50 rounded text-[9px] md:text-[10px] font-medium flex-shrink-0">
                        {getPlatformShortName(chat.platform)}
                      </span>
                      {chat.unreadCount > 0 && (
                        <span className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] md:text-xs text-gray-300 line-clamp-2 mb-1 md:mb-1.5">
                      {chat.lastMessage}
                    </p>
                    <p className="text-[9px] md:text-[10px] text-gray-500">
                      {format(new Date(chat.lastMessageAt), 'd MMM, HH:mm', { locale: uk })}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Thread Modal — повна переписка */}
          {selectedChat && (
            <ModalPortal>
              <div
                className={cn(
                  'modal-overlay sm:!p-4 flex items-center justify-center',
                  fullscreen && '!p-0 !items-stretch !justify-stretch'
                )}
                onClick={() => setSelectedChat(null)}
              >
                <div
                  className={cn(
                    'relative modal-content modal-dialog text-white flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200',
                    fullscreen
                      ? 'w-full h-full max-w-none max-h-none rounded-none sm:rounded-none'
                      : 'w-[95%] sm:w-full max-w-md max-h-[85dvh] rounded-2xl'
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex-shrink-0 flex items-center justify-between gap-2 p-3 sm:p-4 border-b border-white/10">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0',
                        getPlatformBgColor(selectedChat.platform)
                      )}>
                        {getPlatformIcon(selectedChat.platform)}
                      </div>
                      <div className="min-w-0">
                        <div className="modal-title truncate">{selectedChat.senderName}</div>
                        <div className="modal-subtitle">{getPlatformShortName(selectedChat.platform)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setFullscreen((v) => !v)}
                        className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                        title={fullscreen ? 'Згорнути' : 'Розгорнути'}
                        aria-label={fullscreen ? 'Згорнути' : 'Розгорнути'}
                      >
                        {fullscreen ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 6v12M6 18h12" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedChat(null)}
                        className="modal-close touch-target text-gray-400 hover:text-white rounded-xl p-2"
                        aria-label="Закрити"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Scrollable thread */}
                  <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-3 flex flex-col">
                    <div className="flex-1 min-h-[120px] space-y-3 mb-4">
                      {threadLoading ? (
                        <div className="text-sm text-gray-400 py-8 text-center">Завантаження переписки...</div>
                      ) : thread.length === 0 ? (
                        <div className="text-sm text-gray-500 py-8 text-center">Немає повідомлень</div>
                      ) : (
                        thread.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              'rounded-xl p-3 max-w-[90%] sm:max-w-[85%]',
                              msg.direction === 'outbound'
                                ? 'ml-auto bg-blue-600/30 border border-blue-500/30'
                                : 'mr-auto bg-white/5 border border-white/10'
                            )}
                          >
                            <p className="text-xs text-gray-400 mb-0.5">
                              {msg.direction === 'outbound' ? 'Ви' : msg.senderName}
                            </p>
                            <p className="text-sm text-gray-100 whitespace-pre-wrap break-words">{msg.message}</p>
                            <p className="text-[10px] text-gray-500 mt-1">
                              {format(new Date(msg.timestamp), 'd MMM, HH:mm', { locale: uk })}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Reply Input */}
                    <div className="space-y-2 flex-shrink-0">
                      <textarea
                        value={replyText}
                        onChange={(e) => { setReplyText(e.target.value); setReplyError(null) }}
                        placeholder="Введіть відповідь..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-gray-400 resize-none focus:outline-none focus:border-white/20 text-sm"
                        rows={2}
                        style={{ letterSpacing: '-0.01em' }}
                      />
                      {replyError && (
                        <p className="text-xs text-red-400" role="alert">{replyError}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 p-3 sm:p-4 flex-shrink-0 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => handleHideChat(selectedChat)}
                      className="px-3 py-2 text-xs text-gray-400 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      Сховати чат
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteChat(selectedChat)}
                      className="px-3 py-2 text-xs text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      Видалити переписку
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => setSelectedChat(null)}
                      className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors"
                    >
                      Закрити
                    </button>
                    <button
                      onClick={handleReply}
                      disabled={!replyText.trim() || sending || !(selectedChat.firstInboundId || firstInboundIdFromThread)}
                      className="px-4 py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sending ? 'Відправка...' : 'Відправити'}
                    </button>
                  </div>
                </div>
              </div>
            </ModalPortal>
          )}
        </>
      )}
    </div>
  )
}
