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

const SparkleIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
  </svg>
)

export function AIChatWidget({ businessId, className }: AIChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [aiIndicator, setAiIndicator] = useState<{ color: 'green' | 'red'; title: string }>({
    color: 'red',
    title: 'Jarvis: unknown',
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
                ? 'Jarvis: online'
                : hasKey
                  ? `Jarvis: ${reason || 'waiting'}` as string
                  : 'Jarvis: offline',
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
                ? 'Jarvis: online'
                : hasKey
                  ? `Jarvis: ${reason || 'waiting'}` as string
                  : 'Jarvis: offline',
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
    { label: 'Що сьогодні?', text: 'що сьогодні в кабінеті' },
    { label: 'Записи', text: 'скільки записів сьогодні' },
    { label: 'Хто працює', text: 'хто сьогодні працює' },
    { label: 'Вільні слоти', text: 'покажи вільні слоти на завтра' },
    { label: 'Підсумок', text: 'KPI за 7 днів' },
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
      {/* FAB — крутий кнопка з глоу */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] md:bottom-6 md:right-6 w-[68px] h-[68px] rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-600/30 to-rose-600/20 backdrop-blur-2xl border border-amber-400/30 hover:border-amber-400/60 shadow-[0_0_40px_rgba(251,191,36,0.25)] hover:shadow-[0_0_60px_rgba(251,191,36,0.4)] transition-all duration-300 z-[50] flex items-center justify-center touch-manipulation group overflow-hidden"
          title="Jarvis"
        >
          <span className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-inner">
            <BotIcon className="w-5 h-5 text-white drop-shadow-sm" />
          </span>
        </button>
      )}

      {/* Вікно чату */}
      {isOpen && (
        <div
          className={`fixed inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-[420px] md:h-[580px] md:max-h-[88vh] w-full h-full md:rounded-[24px] flex flex-col z-[50] overflow-hidden ${className}`}
          style={{
            background: 'linear-gradient(165deg, rgba(15,15,18,0.98) 0%, rgba(25,22,28,0.98) 50%, rgba(18,15,20,0.98) 100%)',
            boxShadow: '0 25px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.03)',
          }}
        >
          {/* Декоративна сітка */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" aria-hidden>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 50% 0%, rgba(251,191,36,0.15) 0%, transparent 50%),
                  linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.2) 100%)`,
              }}
            />
          </div>

          {/* Хедер */}
          <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div
                className={`relative w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden transition-all duration-300 ${
                  isLoading ? 'scale-105' : ''
                }`}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 50%, #dc2626 100%)',
                  boxShadow: '0 4px 20px -4px rgba(245,158,11,0.5)',
                }}
              >
                <BotIcon className="w-5 h-5 text-white relative z-10" />
                {isLoading && (
                  <span className="absolute inset-0 bg-white/20 animate-pulse" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight text-white">Jarvis</h3>
                <p className="text-[11px] text-amber-400/80 font-medium">{aiIndicator.title}</p>
              </div>
              <span
                className={`ml-1 w-2.5 h-2.5 rounded-full ring-2 ring-offset-2 ring-offset-[#0f0f12] ${
                  aiIndicator.color === 'green'
                    ? 'bg-emerald-400 ring-emerald-500/30 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                    : 'bg-rose-500/80 ring-rose-500/20'
                }`}
                title={aiIndicator.title}
                aria-label={aiIndicator.title}
              />
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <span className="text-lg font-light">×</span>
            </button>
          </div>

          {/* Повідомлення */}
          <div className="relative flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(234,88,12,0.1) 100%)',
                  border: '1px solid rgba(251,191,36,0.2)',
                }}>
                  <SparkleIcon className="w-8 h-8 text-amber-400/70" />
                </div>
                <p className="text-sm font-medium text-white/90 mb-1">Привіт</p>
                <p className="text-xs text-slate-400 text-center max-w-[200px]">
                  Я Jarvis — твій помічник. Знаю все про твій бізнес: записи, клієнти, KPI, графіки, нотатки. Просто напиши, що потрібно — відповім по-людськи.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {msg.role === 'assistant' && (
                  <div
                    className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                      boxShadow: '0 2px 12px -4px rgba(245,158,11,0.4)',
                    }}
                  >
                    <BotIcon className="w-4 h-4 text-white" />
                  </div>
                )}

                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-400/20 text-white'
                      : 'bg-white/[0.04] border border-white/[0.06] text-slate-100'
                  }`}
                  style={
                    msg.role === 'user'
                      ? { boxShadow: '0 4px 20px -8px rgba(251,191,36,0.3)' }
                      : {}
                  }
                >
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                </div>

                {msg.role === 'user' && (
                  <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center bg-slate-600/50 border border-white/5">
                    <UserIcon className="w-4 h-4 text-slate-300" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center animate-pulse"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                    opacity: 0.9,
                  }}
                >
                  <BotIcon className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 bg-amber-400/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2.5 h-2.5 bg-amber-400/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2.5 h-2.5 bg-amber-400/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Футер / інпут */}
          <div className="relative p-4 pt-3 border-t border-white/5 space-y-3">
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
                placeholder={sttListening ? 'Слухаю…' : 'Команда або питання...'}
                className="flex-1 px-4 py-3 text-sm rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/30 min-h-[48px] transition-all"
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
                      ? 'Зупинити'
                      : 'Голос'
                }
                className={`flex items-center justify-center w-12 h-12 rounded-xl border transition-all ${
                  sttListening
                    ? 'bg-amber-500/20 border-amber-400/40 text-amber-400 ring-2 ring-amber-400/30'
                    : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                } ${!sttSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <MicIcon className="w-5 h-5" />
              </button>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || sttListening}
                className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_8px 24px -8px_rgba(245,158,11,0.5)] transition-all disabled:hover:shadow-none"
              >
                <SendIcon className="w-5 h-5" />
              </button>
            </div>

            {sttListening && sttDraft && (
              <p className="text-[11px] text-amber-400/70 px-1 truncate">{sttDraft}</p>
            )}

            <div className="flex flex-wrap gap-2">
              {quickHints.map((h) => (
                <button
                  key={h.label}
                  type="button"
                  disabled={isLoading || sttListening}
                  onClick={() => {
                    setInput('')
                    sendMessage(h.text)
                  }}
                  className="text-[11px] px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 hover:text-amber-400/90 hover:border-amber-400/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  title={h.text}
                >
                  {h.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span>Озвучка:</span>
              <button
                type="button"
                disabled={!ttsSupported}
                onClick={() => setTtsEnabled((v) => !v)}
                className={`px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5 transition-all ${
                  ttsEnabled ? 'bg-amber-500/10 border-amber-400/30 text-amber-400' : 'border-white/10 text-slate-500 hover:text-slate-400'
                } ${!ttsSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={ttsSupported ? (ttsEnabled ? 'Озвучка: увімкнено' : 'Озвучка: вимкнено') : 'Озвучка недоступна'}
              >
                <SpeakerIcon className="w-3.5 h-3.5" />
                {ttsEnabled ? 'Вкл' : 'Вимк'}
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-lg border transition-all ${voiceLang === 'uk-UA' ? 'bg-white/5 border-white/10 text-white' : 'border-white/10 text-slate-500 hover:text-slate-400'}`}
                onClick={() => setVoiceLang('uk-UA')}
                disabled={sttListening}
              >
                UA
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-lg border transition-all ${voiceLang === 'ru-RU' ? 'bg-white/5 border-white/10 text-white' : 'border-white/10 text-slate-500 hover:text-slate-400'}`}
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
