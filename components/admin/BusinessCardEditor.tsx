'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ImageIcon, XIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

interface BusinessCardEditorProps {
  business: {
    id: string
    name: string
    description?: string
    businessCardBackgroundImage?: string
    slogan?: string
    additionalInfo?: string
    socialMedia?: string
    location?: string
  }
  onSave: (data: {
    businessCardBackgroundImage?: string
    slogan?: string
    additionalInfo?: string
    socialMedia?: string
    location?: string
  }) => Promise<void>
}

export function BusinessCardEditor({ business, onSave }: BusinessCardEditorProps) {
  const [backgroundImage, setBackgroundImage] = useState(business.businessCardBackgroundImage || '')
  const [slogan, setSlogan] = useState(business.slogan || '')
  const [additionalInfo, setAdditionalInfo] = useState(business.additionalInfo || '')
  const [location, setLocation] = useState(business.location || '')
  const [socialMedia, setSocialMedia] = useState(() => {
    try {
      return business.socialMedia ? JSON.parse(business.socialMedia) : { facebook: '', instagram: '', telegram: '' }
    } catch {
      return { facebook: '', instagram: '', telegram: '' }
    }
  })
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Для простоти використовуємо base64, в продакшені краще завантажувати на CDN
      const reader = new FileReader()
      reader.onloadend = () => {
        setBackgroundImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave({
        businessCardBackgroundImage: backgroundImage,
        slogan,
        additionalInfo,
        socialMedia: JSON.stringify(socialMedia),
        location,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Preview */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle>Попередній перегляд візитівки</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "relative rounded-candy-lg overflow-hidden min-h-[300px] p-6 flex flex-col justify-between",
              "bg-gradient-to-br from-gray-800 to-gray-900"
            )}
            style={{
              backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative z-10 text-white">
              <h2 className="text-2xl md:text-3xl font-black mb-2">{business.name}</h2>
              {slogan && <p className="text-lg md:text-xl font-bold mb-4 opacity-90">{slogan}</p>}
              {business.description && (
                <p className="text-sm md:text-base mb-4 opacity-80">{business.description}</p>
              )}
              {location && (
                <p className="text-sm md:text-base mb-2 opacity-80">📍 {location}</p>
              )}
              {(socialMedia.facebook || socialMedia.instagram || socialMedia.telegram) && (
                <div className="flex gap-3 mt-4">
                  {socialMedia.facebook && <span className="text-xs">📘 Facebook</span>}
                  {socialMedia.instagram && <span className="text-xs">📷 Instagram</span>}
                  {socialMedia.telegram && <span className="text-xs">✈️ Telegram</span>}
                </div>
              )}
            </div>
            {additionalInfo && (
              <div className="relative z-10 mt-4 pt-4 border-t border-white/20">
                <p className="text-sm text-white/90">{additionalInfo}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle>Редагування візитівки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Background Image */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
              Фонове зображення
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                Завантажити зображення
              </Button>
              {backgroundImage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBackgroundImage('')}
                  className="text-red-600 hover:text-red-700"
                >
                  <XIcon className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Або вставте URL зображення
            </p>
            <Input
              type="text"
              placeholder="https://example.com/image.jpg"
              value={backgroundImage}
              onChange={(e) => setBackgroundImage(e.target.value)}
              className="mt-2"
            />
          </div>

          {/* Slogan */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
              Слоган
            </label>
            <Input
              type="text"
              placeholder="Ваш слоган або короткий опис"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
              Розташування / Адреса
            </label>
            <Input
              type="text"
              placeholder="Вул. Прикладна, 123, Київ"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* Social Media */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
              Соціальні мережі
            </label>
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Facebook URL"
                value={socialMedia.facebook}
                onChange={(e) => setSocialMedia({ ...socialMedia, facebook: e.target.value })}
              />
              <Input
                type="text"
                placeholder="Instagram URL"
                value={socialMedia.instagram}
                onChange={(e) => setSocialMedia({ ...socialMedia, instagram: e.target.value })}
              />
              <Input
                type="text"
                placeholder="Telegram URL або @username"
                value={socialMedia.telegram}
                onChange={(e) => setSocialMedia({ ...socialMedia, telegram: e.target.value })}
              />
            </div>
          </div>

          {/* Additional Info */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
              Додаткова інформація
            </label>
            <textarea
              className="w-full px-3 py-2 text-sm rounded-candy-sm border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-candy-blue focus:border-candy-blue transition-all min-h-[100px]"
              placeholder="Додаткова інформація для клієнтів..."
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
            />
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? 'Збереження...' : 'Зберегти візитівку'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

