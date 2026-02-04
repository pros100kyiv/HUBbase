'use client'

import { useState, useEffect, useRef } from 'react'
import { format, addDays, subDays, isSameDay, startOfDay } from 'date-fns'
import { uk } from 'date-fns/locale'
import { CheckIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

interface Note {
  id: string
  text: string
  completed: boolean
  date: string
  order: number
}

interface NotesCardProps {
  businessId: string
}

export function NotesCard({ businessId }: NotesCardProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()))
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [editText, setEditText] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(currentDate)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  useEffect(() => {
    loadNotes()
  }, [businessId, currentDate])

  const loadNotes = async () => {
    try {
      setLoading(true)
      const dateStr = format(currentDate, 'yyyy-MM-dd')
      const response = await fetch(`/api/notes?businessId=${businessId}&date=${dateStr}`)
      if (response.ok) {
        const data = await response.json()
        setNotes(data || [])
      }
    } catch (error) {
      console.error('Error loading notes:', error)
      setNotes([])
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (noteId: string) => {
    const note = notes.find(n => n.id === noteId)
    if (!note) return

    try {
      const response = await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: noteId,
          completed: !note.completed,
        }),
      })

      if (response.ok) {
        loadNotes()
      }
    } catch (error) {
      console.error('Error toggling note:', error)
    }
  }

  const handleEdit = (note?: Note) => {
    if (note) {
      setEditingNote(note)
      setEditText(note.text)
      setSelectedDate(new Date(note.date))
    } else {
      setEditingNote(null)
      setEditText('')
      setSelectedDate(currentDate)
    }
    setShowEditModal(true)
  }

  const handleSave = async () => {
    if (!editText.trim()) return

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      
      if (editingNote) {
        // Update existing note
        const response = await fetch('/api/notes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingNote.id,
            text: editText.trim(),
            date: dateStr,
          }),
        })

        if (response.ok) {
          loadNotes()
          setShowEditModal(false)
        }
      } else {
        // Create new note
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId,
            text: editText.trim(),
            date: dateStr,
            order: notes.length,
          }),
        })

        if (response.ok) {
          loadNotes()
          setShowEditModal(false)
        }
      }
    } catch (error) {
      console.error('Error saving note:', error)
    }
  }

  const handleDelete = async () => {
    if (!editingNote) return

    try {
      const response = await fetch(`/api/notes?id=${editingNote.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        loadNotes()
        setShowEditModal(false)
      }
    } catch (error) {
      console.error('Error deleting note:', error)
    }
  }

  const handleDateChange = (days: number) => {
    const newDate = addDays(currentDate, days)
    setCurrentDate(startOfDay(newDate))
  }

  const handleDateSelect = (date: Date) => {
    setCurrentDate(startOfDay(date))
    setShowDatePicker(false)
  }

  const isToday = isSameDay(currentDate, new Date())
  const completedCount = notes.filter(n => n.completed).length
  const totalCount = notes.length

  // Swipe handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    setIsDragging(true)
    setStartX(e.pageX - containerRef.current.offsetLeft)
    setScrollLeft(containerRef.current.scrollLeft)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    e.preventDefault()
    const x = e.pageX - containerRef.current.offsetLeft
    const walk = (x - startX) * 2
    containerRef.current.scrollLeft = scrollLeft - walk
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!containerRef.current) return
    setIsDragging(true)
    setStartX(e.touches[0].pageX - containerRef.current.offsetLeft)
    setScrollLeft(containerRef.current.scrollLeft)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return
    const x = e.touches[0].pageX - containerRef.current.offsetLeft
    const walk = (x - startX) * 2
    containerRef.current.scrollLeft = scrollLeft - walk
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  // Generate dates for navigation (7 days before and after)
  const generateDateRange = () => {
    const dates: Date[] = []
    for (let i = -7; i <= 7; i++) {
      dates.push(addDays(currentDate, i))
    }
    return dates
  }

  return (
    <>
      <div className="rounded-xl p-6 card-floating">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white" style={{ letterSpacing: '-0.01em' }}>
            Нотатки
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300 font-medium">{completedCount}/{totalCount}</span>
            <button 
              onClick={() => handleEdit()}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => handleDateChange(-1)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            onClick={() => setShowDatePicker(true)}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm text-white"
          >
            {isToday ? (
              <span>Сьогодні, {format(currentDate, 'd MMM', { locale: uk })}</span>
            ) : (
              <span>{format(currentDate, 'EEEE, d MMM', { locale: uk })}</span>
            )}
          </button>

          <button
            onClick={() => handleDateChange(1)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Swipeable Notes Container */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="overflow-x-auto overflow-y-hidden scrollbar-hide"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <div className="flex gap-4 min-w-max">
            {generateDateRange().map((date, index) => {
              const dateNotes = notes.filter(n => isSameDay(new Date(n.date), date))
              const isSelected = isSameDay(date, currentDate)
              const isDateToday = isSameDay(date, new Date())

              return (
                <div
                  key={index}
                  className={cn(
                    'flex-shrink-0 w-64 rounded-lg p-4 border transition-colors',
                    isSelected
                      ? 'bg-white/10 border-white/20'
                      : 'bg-white/5 border-white/10'
                  )}
                >
                  <div className="mb-3">
                    <span className={cn(
                      'text-xs font-medium',
                      isDateToday ? 'text-blue-400' : 'text-gray-400'
                    )}>
                      {isDateToday ? 'Сьогодні' : format(date, 'd MMM', { locale: uk })}
                    </span>
                  </div>
                  
                  {dateNotes.length === 0 ? (
                    <p className="text-xs text-gray-500">Немає нотаток</p>
                  ) : (
                    <div className="space-y-2">
                      {dateNotes.map((note) => (
                        <div
                          key={note.id}
                          className="flex items-center gap-2 text-xs"
                        >
                          <div
                            onClick={() => handleToggle(note.id)}
                            className={cn(
                              'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0',
                              note.completed
                                ? 'bg-white border-white'
                                : 'bg-transparent border-gray-400'
                            )}
                          >
                            {note.completed && (
                              <CheckIcon className="w-2.5 h-2.5 text-black" />
                            )}
                          </div>
                          <span
                            className={cn(
                              'flex-1 truncate',
                              note.completed
                                ? 'text-gray-400 line-through'
                                : 'text-gray-200'
                            )}
                          >
                            {note.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Current Date Notes */}
        {loading ? (
          <div className="text-center py-4 text-sm text-gray-400">Завантаження...</div>
        ) : (
          <div className="space-y-3 mt-4">
            {notes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400 mb-2">Немає нотаток на цю дату</p>
                <button
                  onClick={() => handleEdit()}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Створити нотатку
                </button>
              </div>
            ) : (
              notes.map((note) => (
                <div 
                  key={note.id}
                  className="flex items-center gap-3 cursor-pointer hover:bg-white/10 rounded-lg p-2 -mx-2 transition-colors"
                  onClick={() => handleEdit(note)}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggle(note.id)
                    }}
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0',
                      note.completed
                        ? 'bg-white border-white'
                        : 'bg-transparent border-gray-400'
                    )}
                  >
                    {note.completed && (
                      <CheckIcon className="w-3 h-3 text-black" />
                    )}
                  </div>
                  <span className={cn(
                    'text-sm flex-1',
                    note.completed
                      ? 'text-gray-400 line-through'
                      : 'text-gray-200'
                  )}>
                    {note.text}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowEditModal(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <div className="relative w-full max-w-md bg-[#2A2A2A] rounded-xl p-6 border border-white/10 z-10 shadow-2xl overflow-y-auto max-h-[90vh]" style={{ position: 'relative', zIndex: 10 }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {editingNote ? 'Редагувати нотатку' : 'Створити нотатку'}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Дата
                </label>
                <input
                  type="date"
                  value={format(selectedDate, 'yyyy-MM-dd')}
                  onChange={(e) => setSelectedDate(new Date(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-white/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Текст нотатки
                </label>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="Введіть текст нотатки..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-gray-400 resize-none focus:outline-none focus:border-white/20"
                  rows={4}
                  style={{ letterSpacing: '-0.01em' }}
                />
              </div>

              <div className="flex gap-2">
                {editingNote && (
                  <button
                    onClick={handleDelete}
                    className="flex-1 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    Видалити
                  </button>
                )}
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors"
                >
                  Скасувати
                </button>
                <button
                  onClick={handleSave}
                  disabled={!editText.trim()}
                  className="flex-1 px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ letterSpacing: '-0.01em' }}
                >
                  Зберегти
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Picker Modal */}
      {showDatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowDatePicker(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <div className="relative w-full max-w-sm bg-[#2A2A2A] rounded-xl p-6 border border-white/10 z-10 shadow-2xl overflow-y-auto max-h-[90vh]" style={{ position: 'relative', zIndex: 10 }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Виберіть дату</h3>
              <button
                onClick={() => setShowDatePicker(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              <input
                type="date"
                value={format(currentDate, 'yyyy-MM-dd')}
                onChange={(e) => {
                  const newDate = new Date(e.target.value)
                  handleDateSelect(newDate)
                }}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-white/20"
              />
              <button
                onClick={() => {
                  handleDateSelect(startOfDay(new Date()))
                  setShowDatePicker(false)
                }}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors"
              >
                Сьогодні
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

