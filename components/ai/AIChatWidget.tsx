'use client'

import { useState, useEffect, useRef } from 'react'
import { BotIcon, SendIcon, UserIcon } from '@/components/icons'

interface Message {
  id: string
  role: 'user' | 'assistant'
  message: string
  timestamp: Date
}

interface AIChatWidgetProps {
  businessId: string
  className?: string
}

const MicIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm6-3a6 6 0 01-12 0m6 7v3m-4 0h8"
    />
  </svg>
)

const SpeakerIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 5l-5 4H3v6h3l5 4V5zm6.5 3.5a5 5 0 010 7M19 7a9 9 0 010 10"
    />
  </svg>
)

export function AIChatWidget({ businessId, className }: AIChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [aiIndicator, setAiIndicator] = useState<{ color: 'green' | 'red'; title: string }>({
    color: 'red',
    title: 'AI: unknown',
  })
  const [voiceLang, setVoiceLang] = useState<'uk-UA' | 'ru-RU'>(() => {
    try {
      const raw = localStorage.getItem('ai_voice_lang')
      return raw === 'ru-RU' ? 'ru-RU' : 'uk-UA'
    } catch {
      return 'uk-UA'
    }
  })
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('ai_tts_enabled')
      // "Out of the box": default ON, but user can toggle and we persist it.
      if (raw === null) return true
      return raw === '1'
    } catch {
      return true
    }
  })
  const [ttsSupported, setTtsSupported] = useState<boolean>(false)
  const [sttSupported, setSttSupported] = useState<boolean>(false)
  const [sttListening, setSttListening] = useState<boolean>(false)
  const [sttDraft, setSttDraft] = useState<string>('')
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sendLockRef = useRef(false)
  const recognitionRef = useRef<any>(null)
  const sttFinalRef = useRef<string>('')
  const sttShouldSendOnEndRef = useRef<boolean>(false)
  const lastSpokenMessageIdRef = useRef<string | null>(null)
  
  useEffect(() => {
    if (isOpen && businessId) {
      fetch(`/api/ai/chat?businessId=${businessId}&sessionId=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.messages) {
            const mapped = data.messages.map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              message: msg.message,
              timestamp: new Date(msg.createdAt)
            }))
            setMessages(mapped)

            // Don't auto-speak old history; only speak new assistant messages.
            const lastAssistant = [...mapped].reverse().find((m: any) => m?.role === 'assistant')
            lastSpokenMessageIdRef.current = lastAssistant?.id || null
          }
          if (data.ai && typeof data.ai === 'object') {
            const hasKey = data.ai.hasKey === true
            const indicator = data.ai.indicator === 'green' ? 'green' : 'red'
            const reason = typeof data.ai.reason === 'string' ? data.ai.reason : null
            setAiIndicator({
              color: indicator,
              title: indicator === 'green'
                ? 'AI: key connected'
                : hasKey
                  ? `AI: key present, not used (${reason || 'fallback'})`
                  : 'AI: key missing',
            })
          }
        })
        .catch(err => console.error('Error loading chat history:', err))
    }
  }, [isOpen, businessId, sessionId])
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    // Web Speech API support varies by browser (Chrome/Edge are best).
    try {
      const w = window as any
      const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
      setSttSupported(!!Ctor)
    } catch {
      setSttSupported(false)
    }
  }, [])

  useEffect(() => {
    try {
      setTtsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined')
    } catch {
      setTtsSupported(false)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('ai_voice_lang', voiceLang)
    } catch {
      // ignore
    }
  }, [voiceLang])

  useEffect(() => {
    try {
      localStorage.setItem('ai_tts_enabled', ttsEnabled ? '1' : '0')
    } catch {
      // ignore
    }
  }, [ttsEnabled])

  const speak = (text: string) => {
    if (!ttsSupported || !ttsEnabled) return
    const t = String(text || '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!t) return

    // Keep it short for UX and to avoid long monologues.
    const say = t.length > 420 ? `${t.slice(0, 420).trim()}…` : t

    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(say)
      u.lang = voiceLang
      u.rate = 1
      u.pitch = 1.05
      u.volume = 1
      window.speechSynthesis.speak(u)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!ttsEnabled || !ttsSupported) return
    if (!messages.length) return
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant') return
    if (lastSpokenMessageIdRef.current === last.id) return
    lastSpokenMessageIdRef.current = last.id
    speak(last.message)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, ttsEnabled, ttsSupported, voiceLang])

  const resolveBusinessId = (): string => {
    const fromProp = (businessId || '').trim()
    if (fromProp) return fromProp
    try {
      const raw = localStorage.getItem('business')
      if (!raw) return ''
      const parsed = JSON.parse(raw)
      return typeof parsed?.id === 'string' ? parsed.id : ''
    } catch {
      return ''
    }
  }

  const toErrorText = (err: unknown): string => {
    if (err instanceof Error) return err.message
    if (typeof err === 'string') return err
    return 'Невідома помилка'
  }

  const ensureRecognition = (): any | null => {
    if (recognitionRef.current) return recognitionRef.current
    try {
      const w = window as any
      const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
      if (!Ctor) return null
      const recognition = new Ctor()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognitionRef.current = recognition
      return recognition
    } catch {
      return null
    }
  }

  const startListening = () => {
    if (!sttSupported || sttListening) return
    const recognition = ensureRecognition()
    if (!recognition) {
      setSttSupported(false)
      return
    }

    setSttDraft('')
    sttFinalRef.current = ''
    // UX: auto-send on end (user doesn't need to "hold" the button).
    sttShouldSendOnEndRef.current = true

    recognition.lang = voiceLang

    recognition.onresult = (event: any) => {
      try {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i]
          const transcript = String(res?.[0]?.transcript || '')
          if (!transcript) continue
          if (res.isFinal) sttFinalRef.current += `${transcript} `
          else interim += transcript
        }
        const nextDraft = `${sttFinalRef.current}${interim}`.trim()
        setSttDraft(nextDraft)
      } catch {
        // ignore
      }
    }

    recognition.onerror = (event: any) => {
      setSttListening(false)
      sttShouldSendOnEndRef.current = false
      const err = typeof event?.error === 'string' ? event.error : 'speech_error'
      setMessages((prev) => [
        ...prev,
        {
          id: `stt_error_${Date.now()}`,
          role: 'assistant',
          message:
            err === 'not-allowed' || err === 'service-not-allowed'
              ? 'Немає доступу до мікрофона. Дозволь мікрофон у браузері.'
              : 'Не вдалось розпізнати голос. Спробуй ще раз або напиши текстом.',
          timestamp: new Date(),
        },
      ])
    }

    recognition.onend = async () => {
      setSttListening(false)
      const shouldSend = sttShouldSendOnEndRef.current
      sttShouldSendOnEndRef.current = false

      const finalText = String(sttFinalRef.current || '').trim()
      const draft = String(sttDraft || '').trim()
      const text = finalText || draft
      sttFinalRef.current = ''
      setSttDraft('')

      if (shouldSend && text) {
        await sendMessage(text)
      }
    }

    try {
      setSttListening(true)
      recognition.start()
    } catch (e) {
      setSttListening(false)
      setMessages((prev) => [
        ...prev,
        {
          id: `stt_start_error_${Date.now()}`,
          role: 'assistant',
          message: `Голос недоступний: ${toErrorText(e)}`,
          timestamp: new Date(),
        },
      ])
    }
  }

  const toggleListening = () => {
    if (!sttSupported || isLoading) return
    if (sttListening) {
      // Keep shouldSend=true (default) so "stop" sends transcript.
      try {
        recognitionRef.current?.stop?.()
      } catch {
        // ignore
      }
      return
    }
    startListening()
  }

  const sendMessage = async (rawText: string) => {
    const userMessage = (rawText || '').trim()
    // Prevent duplicate submissions (Enter repeat / double click) before React state updates.
    if (!userMessage || isLoading || sendLockRef.current) return

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      message: userMessage,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)
    sendLockRef.current = true

    try {
      const resolvedBusinessId = resolveBusinessId()
      if (!resolvedBusinessId) {
        throw new Error('Не знайдено businessId. Оновіть сторінку або переввійдіть в акаунт.')
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: resolvedBusinessId,
          message: userMessage,
          sessionId,
        }),
      })

      let data: any = null
      try {
        data = await response.json()
      } catch {
        data = null
      }

      if (!response.ok) {
        const serverError = data?.error || `HTTP ${response.status}`
        throw new Error(serverError)
      }

      if (data.success) {
        if (data.ai && typeof data.ai === 'object') {
          const hasKey = data.ai.hasKey === true
          const indicator = data.ai.indicator === 'green' ? 'green' : 'red'
          const reason = typeof data.ai.reason === 'string' ? data.ai.reason : null
          setAiIndicator({
            color: indicator,
            title:
              indicator === 'green'
                ? 'AI: using key'
                : hasKey
                  ? `AI: key present, not used (${reason || 'fallback'})`
                  : 'AI: key missing',
          })
        }
        const aiMsg: Message = {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          message: data.message,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, aiMsg])
      } else {
        throw new Error(data.error || 'Failed to get response')
      }
    } catch (error) {
      const errorMsg: Message = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        message: `Вибачте, сталася помилка: ${toErrorText(error)}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
      sendLockRef.current = false
    }
  }

  const quickHints: Array<{ label: string; text: string }> = [
    { label: 'Огляд', text: 'огляд кабінету' },
    { label: 'Записи сьогодні', text: 'скільки записів сьогодні' },
    { label: 'Хто працює', text: 'хто сьогодні працює' },
    { label: 'Вільні слоти', text: 'покажи вільні слоти на завтра' },
    { label: 'Payments 30д', text: 'payments за 30 днів' },
    { label: 'Інбокс', text: 'покажи інбокс' },
  ]

  const handleSend = async () => {
    const userMessage = input.trim()
    if (!userMessage) return
    setInput('')
    await sendMessage(userMessage)
  }
  
  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] md:bottom-4 md:right-4 w-14 h-14 min-w-[56px] min-h-[56px] rounded-full bg-gradient-to-r from-candy-blue to-candy-purple text-white shadow-soft-xl hover:shadow-soft-2xl transition-all z-[50] flex items-center justify-center touch-manipulation"
          title="AI Помічник"
        >
          <BotIcon className="w-6 h-6" />
        </button>
      )}
      
      {isOpen && (
        <div className={`fixed inset-0 md:inset-auto md:bottom-4 md:right-[max(1rem,env(safe-area-inset-right))] md:w-96 md:h-[500px] md:max-h-[85vh] w-full h-full md:rounded-xl bg-white dark:bg-gray-800 shadow-soft-2xl flex flex-col z-[50] ${className}`}>
          <div className="p-4 pt-[max(1rem,env(safe-area-inset-top))] border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BotIcon className="w-5 h-5 text-candy-purple" />
              <h3 className="text-sm font-black text-gray-900 dark:text-white">AI Помічник</h3>
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${aiIndicator.color === 'green' ? 'bg-green-500' : 'bg-red-500'}`}
                title={aiIndicator.title}
                aria-label={aiIndicator.title}
              />
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8 text-xs text-gray-500 dark:text-gray-400">
                Привіт! Я AI помічник. Чим можу допомогти?
              </div>
            )}
            
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-candy-blue to-candy-purple flex items-center justify-center flex-shrink-0">
                    <BotIcon className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] rounded-candy-xs p-2 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-candy-blue to-candy-purple text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                >
                  <p className="text-xs whitespace-pre-wrap">{msg.message}</p>
                </div>
                
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-candy-blue to-candy-purple flex items-center justify-center">
                  <BotIcon className="w-4 h-4 text-white" />
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-candy-xs p-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          <div className="p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.repeat) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={sttListening ? 'Слухаю…' : 'Напишіть повідомлення...'}
                className="flex-1 px-3 py-2.5 md:py-2 text-sm md:text-xs border border-gray-300 dark:border-gray-600 rounded-candy-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-candy-purple min-h-[44px] md:min-h-0"
                disabled={isLoading || sttListening}
              />
              <button
                type="button"
                disabled={!sttSupported || isLoading}
                onClick={(e) => {
                  e.preventDefault()
                  toggleListening()
                }}
                title={
                  !sttSupported
                    ? 'Голос доступний у Chrome/Edge'
                    : sttListening
                      ? 'Зупинити (натисни ще раз)'
                      : 'Почати говорити'
                }
                className={`px-3 py-2 rounded-candy-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:shadow-soft-lg transition-all ${
                  sttListening ? 'ring-2 ring-candy-purple' : ''
                } ${!sttSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <MicIcon className="w-4 h-4" />
              </button>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || sttListening}
                className="px-4 py-2 bg-gradient-to-r from-candy-blue to-candy-purple text-white rounded-candy-xs disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-soft-lg transition-all"
              >
                <SendIcon className="w-4 h-4" />
              </button>
            </div>
            {sttListening && sttDraft && (
              <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
                {sttDraft}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {quickHints.map((h) => (
                <button
                  key={h.label}
                  type="button"
                  disabled={isLoading || sttListening}
                  onClick={() => {
                    setInput('')
                    sendMessage(h.text)
                  }}
                  className="text-[11px] px-2 py-1 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={h.text}
                >
                  {h.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
              <span>Voice:</span>
              <button
                type="button"
                disabled={!ttsSupported}
                onClick={() => setTtsEnabled((v) => !v)}
                className={`px-2 py-1 rounded border border-gray-300 dark:border-gray-600 inline-flex items-center gap-1 ${
                  ttsEnabled ? 'bg-gray-200 dark:bg-gray-600' : ''
                } ${!ttsSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={ttsSupported ? (ttsEnabled ? 'Озвучка: увімкнено' : 'Озвучка: вимкнено') : 'Озвучка недоступна у цьому браузері'}
              >
                <SpeakerIcon className="w-3.5 h-3.5" />
                Озвуч.
              </button>
              <button
                type="button"
                className={`px-2 py-1 rounded border border-gray-300 dark:border-gray-600 ${voiceLang === 'uk-UA' ? 'bg-gray-200 dark:bg-gray-600' : ''}`}
                onClick={() => setVoiceLang('uk-UA')}
                disabled={sttListening}
              >
                UA
              </button>
              <button
                type="button"
                className={`px-2 py-1 rounded border border-gray-300 dark:border-gray-600 ${voiceLang === 'ru-RU' ? 'bg-gray-200 dark:bg-gray-600' : ''}`}
                onClick={() => setVoiceLang('ru-RU')}
                disabled={sttListening}
              >
                RU
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

