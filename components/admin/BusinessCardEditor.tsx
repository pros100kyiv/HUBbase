'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ImageIcon } from '@/components/icons'

interface BusinessCardEditorProps {
  business: {
    id: string
    name: string
    businessCardBackgroundImage?: string | null
    slogan?: string | null
    additionalInfo?: string | null
    socialMedia?: string | null
    location?: string | null
  }
  onSave: (data: {
    businessCardBackgroundImage?: string | null
    slogan?: string | null
    additionalInfo?: string | null
    socialMedia?: string | null
    location?: string | null
  }) => Promise<void>
}

export function BusinessCardEditor({ business, onSave }: BusinessCardEditorProps) {
  const [formData, setFormData] = useState({
    businessCardBackgroundImage: business.businessCardBackgroundImage || '',
    slogan: business.slogan || '',
    additionalInfo: business.additionalInfo || '',
    socialMedia: business.socialMedia || '',
    location: business.location || '',
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setFormData({
        ...formData,
        businessCardBackgroundImage: reader.result as string,
      })
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await onSave({
        businessCardBackgroundImage: formData.businessCardBackgroundImage || null,
        slogan: formData.slogan || null,
        additionalInfo: formData.additionalInfo || null,
        socialMedia: formData.socialMedia || null,
        location: formData.location || null,
      })
    } catch (error) {
      console.error('Error saving business card:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="card-candy">
      <CardHeader>
        <CardTitle className="text-subheading">Візитівка бізнесу</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Background Image */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              Фонове зображення
            </label>
            <div className="flex items-center gap-3">
              {formData.businessCardBackgroundImage && (
                <img
                  src={formData.businessCardBackgroundImage}
                  alt="Background"
                  className="w-24 h-24 object-cover rounded-candy-sm border border-gray-200 dark:border-gray-700"
                />
              )}
              <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-candy-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <ImageIcon className="w-4 h-4" />
                <span className="text-sm font-medium">Завантажити зображення</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Slogan */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              Слоган
            </label>
            <Input
              value={formData.slogan}
              onChange={(e) => setFormData({ ...formData, slogan: e.target.value })}
              placeholder="Наприклад: Ваша краса - наш пріоритет"
            />
          </div>

          {/* Additional Info */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              Додаткова інформація
            </label>
            <textarea
              value={formData.additionalInfo}
              onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
              placeholder="Опис послуг, особливості, контакти..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-candy-sm bg-white dark:bg-gray-800 text-foreground min-h-[100px]"
            />
          </div>

          {/* Social Media */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              Соціальні мережі (JSON або текст)
            </label>
            <Input
              value={formData.socialMedia}
              onChange={(e) => setFormData({ ...formData, socialMedia: e.target.value })}
              placeholder='{"instagram": "@business", "facebook": "business"}'
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              Локація
            </label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Адреса або координати"
            />
          </div>

          <Button
            type="submit"
            disabled={isSaving}
            className="btn-primary w-full"
          >
            {isSaving ? 'Збереження...' : 'Зберегти візитівку'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
