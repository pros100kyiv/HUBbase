'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './toast'

interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  description: string
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : !(e.ctrlKey || e.metaKey)
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        const altMatch = shortcut.alt ? e.altKey : !e.altKey
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          e.preventDefault()
          shortcut.action()
        }
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

export function KeyboardShortcutsHelper() {
  const router = useRouter()

  useKeyboardShortcuts([
    {
      key: 'k',
      ctrl: true,
      action: () => {
        toast({
          title: 'Гарячі клавіші',
          description: 'Ctrl+K - Пошук | Ctrl+/ - Допомога | Ctrl+N - Новий запис',
          type: 'info',
          duration: 3000,
        })
      },
      description: 'Показати допомогу',
    },
    {
      key: '/',
      ctrl: true,
      action: () => {
        toast({
          title: 'Гарячі клавіші',
          description: 'Ctrl+K - Пошук | Ctrl+/ - Допомога | Ctrl+N - Новий запис',
          type: 'info',
          duration: 3000,
        })
      },
      description: 'Показати допомогу',
    },
    {
      key: 'h',
      ctrl: true,
      action: () => router.push('/dashboard/main'),
      description: 'Головна',
    },
    {
      key: 'a',
      ctrl: true,
      action: () => router.push('/dashboard/analytics'),
      description: 'Аналітика',
    },
    {
      key: 's',
      ctrl: true,
      action: () => router.push('/dashboard/settings'),
      description: 'Налаштування',
    },
  ])

  return null
}



