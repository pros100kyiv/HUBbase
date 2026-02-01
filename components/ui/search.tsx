'use client'

import { useState, useRef, useEffect } from 'react'
import { SearchIcon, XIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

interface SearchProps {
  placeholder?: string
  onSearch: (query: string) => void
  className?: string
  debounceMs?: number
}

export function Search({ placeholder = 'Пошук...', onSearch, className, debounceMs = 300 }: SearchProps) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      onSearch(query)
    }, debounceMs)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [query, onSearch, debounceMs])

  const clearSearch = () => {
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div
      className={cn(
        'relative flex items-center gap-2 rounded-candy-sm border-2 transition-all duration-200',
        'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
        isFocused && 'border-candy-purple dark:border-purple-400 shadow-soft-lg',
        className
      )}
    >
      <div className="pl-3 text-gray-400 dark:text-gray-500">
        <SearchIcon className="w-5 h-5" />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={cn(
          'flex-1 py-2.5 pr-3 bg-transparent text-sm font-medium',
          'text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500',
          'focus:outline-none'
        )}
      />
      {query && (
        <button
          onClick={clearSearch}
          className="pr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <XIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}



