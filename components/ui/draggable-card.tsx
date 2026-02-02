'use client'

import { ReactNode, useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface DraggableCardProps {
  children: ReactNode
  id: string
  defaultPosition?: { x: number; y: number }
  defaultSize?: { width: number; height: number }
  minWidth?: number
  minHeight?: number
  className?: string
  onPositionChange?: (id: string, position: { x: number; y: number }) => void
  onSizeChange?: (id: string, size: { width: number; height: number }) => void
}

export function DraggableCard({
  children,
  id,
  defaultPosition = { x: 0, y: 0 },
  defaultSize,
  minWidth = 200,
  minHeight = 150,
  className,
  onPositionChange,
  onSizeChange,
}: DraggableCardProps) {
  const [position, setPosition] = useState(defaultPosition)
  const [size, setSize] = useState(defaultSize || { width: 300, height: 200 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Завантажуємо збережені позиції з localStorage
    const saved = localStorage.getItem(`card-${id}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.position) setPosition(parsed.position)
        if (parsed.size) setSize(parsed.size)
      } catch (e) {
        // Ignore
      }
    }
  }, [id])

  const savePosition = (pos: { x: number; y: number }, siz?: { width: number; height: number }) => {
    localStorage.setItem(`card-${id}`, JSON.stringify({
      position: pos,
      size: siz || size,
    }))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('resize-handle')) return
    
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResizing(true)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newPosition = {
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        }
        setPosition(newPosition)
        onPositionChange?.(id, newPosition)
        savePosition(newPosition)
      } else if (isResizing) {
        const rect = cardRef.current?.getBoundingClientRect()
        if (rect) {
          const newSize = {
            width: Math.max(minWidth, e.clientX - rect.left),
            height: Math.max(minHeight, e.clientY - rect.top),
          }
          setSize(newSize)
          onSizeChange?.(id, newSize)
          savePosition(position, newSize)
        }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, dragStart, id, minWidth, minHeight, onPositionChange, onSizeChange, position])

  return (
    <div
      ref={cardRef}
      className={cn(
        'absolute bg-gray-800 dark:bg-gray-900 border border-gray-700 rounded-candy-lg backdrop-blur-sm shadow-soft-xl',
        'cursor-move select-none',
        isDragging && 'cursor-grabbing',
        className
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: defaultSize ? `${size.width}px` : 'auto',
        height: defaultSize ? `${size.height}px` : 'auto',
        zIndex: isDragging || isResizing ? 1000 : 1,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="p-4 h-full overflow-auto">
        {children}
      </div>
      {defaultSize && (
        <div
          className="resize-handle absolute bottom-0 right-0 w-4 h-4 bg-candy-blue cursor-nwse-resize opacity-50 hover:opacity-100 transition-opacity"
          onMouseDown={handleResizeStart}
          style={{
            clipPath: 'polygon(100% 0, 0 100%, 100% 100%)',
          }}
        />
      )}
    </div>
  )
}


