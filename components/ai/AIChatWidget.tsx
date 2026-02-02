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

export function AIChatWidget({ businessId, className }: AIChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (isOpen && businessId) {
      fetch(`/api/ai/chat?businessId=${businessId}&sessionId=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.messages) {
            setMessages(data.messages.map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              message: msg.message,
              timestamp: new Date(msg.createdAt)
            })))
          }
        })
        .catch(err => console.error('Error loading chat history:', err))
    }
  }, [isOpen, businessId, sessionId])
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    
    const userMessage = input.trim()
    setInput('')
    
    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      message: userMessage,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          message: userMessage,
          sessionId
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        const aiMsg: Message = {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          message: data.message,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, aiMsg])
      } else {
        throw new Error(data.error || 'Failed to get response')
      }
    } catch (error) {
      const errorMsg: Message = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        message: 'Вибачте, сталася помилка. Спробуйте пізніше.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 w-14 h-14 rounded-full bg-gradient-to-r from-candy-blue to-candy-purple text-white shadow-soft-xl hover:shadow-soft-2xl transition-all z-50 flex items-center justify-center"
          title="AI Помічник"
        >
          <BotIcon className="w-6 h-6" />
        </button>
      )}
      
      {isOpen && (
        <div className={`fixed bottom-4 right-4 w-96 h-[500px] bg-white dark:bg-gray-800 rounded-candy-sm shadow-soft-2xl flex flex-col z-50 ${className}`}>
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BotIcon className="w-5 h-5 text-candy-purple" />
              <h3 className="text-sm font-black text-gray-900 dark:text-white">AI Помічник</h3>
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
          
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Напишіть повідомлення..."
                className="flex-1 px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-candy-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-candy-purple"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="px-4 py-2 bg-gradient-to-r from-candy-blue to-candy-purple text-white rounded-candy-xs disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-soft-lg transition-all"
              >
                <SendIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

