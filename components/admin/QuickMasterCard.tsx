'use client'

import { useState, useEffect } from 'react'
import { XIcon, UserIcon, ImageIcon, CheckIcon, StarIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'
import { ErrorToast } from '@/components/ui/error-toast'

interface QuickMasterCardProps {
  businessId: string
  onSuccess?: (master: any) => void
  onCancel?: () => void
  editingMaster?: {
    id: string
    name: string
    photo?: string | null
    bio?: string | null
    rating?: number
    isActive?: boolean
  } | null
}

export function QuickMasterCard({
  businessId,
  onSuccess,
  onCancel,
  editingMaster = null,
}: QuickMasterCardProps) {
  const [formData, setFormData] = useState({
    name: editingMaster?.name || '',
    photo: editingMaster?.photo || '',
    bio: editingMaster?.bio || '',
    rating: editingMaster?.rating || 0,
    isActive: editingMaster?.isActive !== undefined ? editingMaster.isActive : true,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showErrorToast, setShowErrorToast] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  useEffect(() => {
    if (editingMaster) {
      setFormData({
        name: editingMaster.name || '',
        photo: editingMaster.photo || '',
        bio: editingMaster.bio || '',
        rating: editingMaster.rating || 0,
        isActive: editingMaster.isActive !== undefined ? editingMaster.isActive : true,
      })
      if (editingMaster.photo) {
        setPhotoPreview(editingMaster.photo)
      }
    }
  }, [editingMaster])

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Перевірка розміру файлу (макс 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('Розмір фото не повинен перевищувати 5MB')
        setShowErrorToast(true)
        return
      }

      // Перевірка типу файлу
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Файл повинен бути зображенням')
        setShowErrorToast(true)
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setPhotoPreview(result)
        setFormData((prev) => ({ ...prev, photo: result }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setShowErrorToast(false)

    // Валідація
    if (!formData.name.trim()) {
      setErrorMessage('Введіть ім\'я спеціаліста')
      setShowErrorToast(true)
      setIsSubmitting(false)
      return
    }

    try {
      let master

      if (editingMaster) {
        // Оновлюємо існуючого спеціаліста
        const updateResponse = await fetch(`/api/masters/${editingMaster.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId,
            name: formData.name.trim(),
            photo: formData.photo.trim() || null,
            bio: formData.bio.trim() || null,
            rating: formData.rating || 0,
            isActive: formData.isActive,
          }),
        })

        if (!updateResponse.ok) {
          const error = await updateResponse.json()
          throw new Error(error.error || 'Не вдалося оновити спеціаліста')
        }

        master = await updateResponse.json()
      } else {
        // Створюємо нового спеціаліста
        const createResponse = await fetch('/api/masters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId,
            name: formData.name.trim(),
            photo: formData.photo.trim() || null,
            bio: formData.bio.trim() || null,
            rating: formData.rating || 0,
          }),
        })

        if (!createResponse.ok) {
          const error = await createResponse.json()
          throw new Error(error.error || 'Не вдалося створити спеціаліста')
        }

        master = await createResponse.json()
      }

      toast({
        title: 'Успішно!',
        description: editingMaster ? 'Спеціаліста оновлено' : 'Спеціаліста створено',
        type: 'success',
      })

      if (onSuccess) {
        onSuccess(master)
      }
    } catch (error) {
      console.error('Error saving master:', error)
      const errorMsg = error instanceof Error ? error.message : 'Не вдалося зберегти спеціаліста'
      setErrorMessage(errorMsg)
      setShowErrorToast(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-candy-lg shadow-soft-xl p-4 sm:p-6 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-2 rounded-candy-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        )}

        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-candy-blue dark:text-blue-400 mb-1 sm:mb-2">
            {editingMaster ? 'Редагувати спеціаліста' : 'Додати спеціаліста'}
          </h2>
          <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400">
            {editingMaster ? 'Оновіть інформацію про спеціаліста' : 'Заповніть основну інформацію про спеціаліста'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          {/* Photo Upload */}
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-gray-700 dark:text-gray-300">
              Фото спеціаліста
            </label>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-candy-purple/20 to-candy-blue/20 flex items-center justify-center overflow-hidden border-2 border-gray-200 dark:border-gray-700 flex-shrink-0">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                  id="photo-upload"
                />
                <label
                  htmlFor="photo-upload"
                  className="block px-2 sm:px-4 py-1.5 sm:py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-candy-xs cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-[10px] sm:text-sm font-bold touch-manipulation text-center"
                >
                  Завантажити фото
                </label>
                {formData.photo && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, photo: '' }))
                      setPhotoPreview(null)
                    }}
                    className="mt-1 w-full px-2 py-1 text-[10px] sm:text-xs text-red-500 hover:text-red-700 touch-manipulation"
                  >
                    Видалити
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-gray-700 dark:text-gray-300">
              Ім'я спеціаліста *
            </label>
            <div className="relative">
              <UserIcon className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Наприклад: Олександр"
                required
                className="w-full pl-8 sm:pl-10 pr-2 sm:pr-3 py-1.5 sm:py-2 rounded-candy-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-candy-blue text-sm"
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-gray-700 dark:text-gray-300">
              Опис / Біографія
            </label>
            <textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
              placeholder="Короткий опис спеціаліста, досвід роботи..."
              rows={3}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded-candy-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-candy-blue resize-none text-sm"
            />
          </div>

          {/* Rating */}
          <div>
            <label htmlFor="rating" className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-gray-700 dark:text-gray-300">
              Рейтинг (0-5)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="rating"
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={formData.rating}
                onChange={(e) => setFormData((prev) => ({ ...prev, rating: parseFloat(e.target.value) || 0 }))}
                className="w-16 sm:w-20 px-2 sm:px-3 py-1.5 sm:py-2 rounded-candy-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-candy-blue text-sm"
              />
              <div className="flex gap-0.5 sm:gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, rating: star }))}
                    className={cn(
                      "transition-colors touch-manipulation",
                      star <= formData.rating
                        ? "text-yellow-400"
                        : "text-gray-300 dark:text-gray-600"
                    )}
                  >
                    <StarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Is Active */}
          {editingMaster && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                className="w-4 h-4 sm:w-5 sm:h-5 rounded border-gray-300 dark:border-gray-700 text-candy-blue focus:ring-candy-blue touch-manipulation"
              />
              <label htmlFor="isActive" className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                Активний спеціаліст
              </label>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-candy-purple to-candy-blue text-white font-black rounded-candy-sm shadow-soft-xl hover:shadow-soft-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base touch-manipulation"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-xs sm:text-sm">{editingMaster ? 'Збереження...' : 'Створення...'}</span>
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm">{editingMaster ? 'Зберегти зміни' : 'Створити спеціаліста'}</span>
              </>
            )}
          </button>
        </form>

        {/* Error Toast */}
        {showErrorToast && errorMessage && (
          <ErrorToast
            message={errorMessage}
            onClose={() => {
              setShowErrorToast(false)
              setErrorMessage('')
            }}
          />
        )}
      </div>
    </div>
  )
}

