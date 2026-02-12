'use client'

import { useState, useEffect } from 'react'
import { format, addDays, startOfDay, isSameDay } from 'date-fns'
import { uk } from 'date-fns/locale'
import { ModalPortal } from '@/components/ui/modal-portal'

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
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [editText, setEditText] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()))
  const [loading, setLoading] = useState(true)

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
        const response = await fetch('/api/notes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingNote.id, text: editText.trim(), date: dateStr }),
        })
        if (response.ok) {
          loadNotes()
          setShowEditModal(false)
        }
      } else {
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
      const response = await fetch(`/api/notes?id=${editingNote.id}`, { method: 'DELETE' })
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

  return (
    <>
      <div className="rounded-xl p-4 md:p-6 card-glass min-w-0 w-full max-w-full overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-3 md:mb-4 min-w-0">
          <h3 className="text-base md:text-lg font-semibold text-white truncate min-w-0" style={{ letterSpacing: '-0.01em' }}>
            Нотатки
          </h3>
          <button
            onClick={() => handleEdit()}
            className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Створити нотатку"
          >
            <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Date Navigation */}
        <div className="mb-3 md:mb-4 flex items-center justify-between gap-2 min-w-0">
          <button
            onClick={() => handleDateChange(-1)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={() => setShowDatePicker(true)}
            className="px-2 md:px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-xs md:text-sm text-white flex-1 min-w-0 overflow-hidden text-left"
          >
            {isToday ? (
              <span className="block truncate">Сьогодні, {format(currentDate, 'd MMM', { locale: uk })}</span>
            ) : (
              <span className="block truncate">{format(currentDate, 'EEEE, d MMM', { locale: uk })}</span>
            )}
          </button>

          <button
            onClick={() => handleDateChange(1)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Notes List */}
        {loading ? (
          <div className="text-center py-4 text-xs md:text-sm text-gray-400">Завантаження...</div>
        ) : (
          <div className="space-y-2 md:space-y-3">
            {notes.length === 0 ? (
              <div className="text-center py-6 md:py-8">
                <p className="text-xs md:text-sm text-gray-400 mb-2">Немає нотаток на цю дату</p>
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
                  onClick={() => handleEdit(note)}
                  className="flex items-center gap-2 md:gap-3 cursor-pointer hover:bg-white/10 rounded-lg p-2 -mx-2 transition-colors active:scale-[0.98] touch-manipulation min-h-[44px]"
                >
                  <span className="text-xs md:text-sm flex-1 text-gray-200">{note.text}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => setShowEditModal(false)}>
            <div
              className="relative w-[95%] sm:w-full max-w-md modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="modal-close touch-target text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30 rounded-xl"
                aria-label="Закрити"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="pr-10 mb-2">
                <h3 className="modal-title">
                  {editingNote ? 'Редагувати нотатку' : 'Створити нотатку'}
                </h3>
              </div>

              <div className="space-y-2.5 flex-1 min-h-0 overflow-y-auto pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Дата</label>
                  <input
                    type="date"
                    value={format(selectedDate, 'yyyy-MM-dd')}
                    onChange={(e) => setSelectedDate(new Date(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Текст нотатки</label>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder="Введіть текст нотатки..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-gray-400 resize-none focus:outline-none focus:border-white/20"
                    rows={4}
                    style={{ letterSpacing: '-0.01em' }}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {editingNote && (
                    <button
                      onClick={handleDelete}
                      className="touch-target flex-1 min-w-[100px] px-4 py-2.5 min-h-[44px] bg-red-500/20 border border-red-500/50 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors"
                    >
                      Видалити
                    </button>
                  )}
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="touch-target flex-1 min-w-[100px] px-4 py-2.5 min-h-[44px] bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors"
                  >
                    Скасувати
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!editText.trim()}
                    className="touch-target flex-1 min-w-[100px] px-4 py-2.5 min-h-[44px] bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ letterSpacing: '-0.01em' }}
                  >
                    Зберегти
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Date Picker Modal */}
      {showDatePicker && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => setShowDatePicker(false)}>
            <div
              className="relative w-[95%] sm:w-full max-w-sm modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowDatePicker(false)}
                className="modal-close touch-target text-gray-400 hover:text-white rounded-xl"
                aria-label="Закрити"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h3 className="modal-title pr-10 mb-2">Виберіть дату</h3>

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
        </ModalPortal>
      )}
    </>
  )
}
