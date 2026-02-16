'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ImageIcon, CheckIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

interface BusinessCardEditorProps {
  business: {
    id: string
    name: string
    slug?: string | null
    businessIdentifier?: string | null
    description?: string | null
    logo?: string | null
    avatar?: string | null
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

  useEffect(() => {
    setFormData({
      businessCardBackgroundImage: business.businessCardBackgroundImage || '',
      slogan: business.slogan || '',
      additionalInfo: business.additionalInfo || '',
      socialMedia: business.socialMedia || '',
      location: business.location || '',
    })
  }, [business.id, business.businessCardBackgroundImage, business.slogan, business.additionalInfo, business.socialMedia, business.location])

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

  const bookingParam = business.businessIdentifier || business.slug || ''
  const bookingUrl = typeof window !== 'undefined' && bookingParam
    ? `${window.location.origin}/booking/${encodeURIComponent(bookingParam)}`
    : ''

  const socialsPreview = useMemo(() => {
    const raw = formData.socialMedia?.trim()
    if (!raw) return null as null | Record<string, string>
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const out: Record<string, string> = {}
        for (const k of ['instagram', 'facebook', 'telegram', 'tiktok', 'website']) {
          const v = (parsed as any)[k]
          if (typeof v === 'string' && v.trim()) out[k] = v.trim()
        }
        return Object.keys(out).length ? out : null
      }
    } catch {
      // not json
    }
    return { links: raw } as any
  }, [formData.socialMedia])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-white mb-1" style={{ letterSpacing: '-0.02em' }}>
            Візитівка (бронювання)
          </h2>
          <p className="text-sm text-gray-400">
            Те, що клієнти бачать на головному екрані сторінки бронювання.
          </p>
        </div>
        {bookingUrl && (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="touch-target min-h-[44px] px-4 py-2 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 text-sm font-semibold transition-colors"
          >
            Відкрити бронювання
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4 min-w-0">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Фонове зображення</label>
            <div className="flex items-center gap-3 flex-wrap">
              {formData.businessCardBackgroundImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={formData.businessCardBackgroundImage}
                  alt="Background"
                  className="w-24 h-24 object-cover rounded-xl border border-white/15 bg-white/10"
                />
              )}
              <label className="touch-target min-h-[44px] inline-flex items-center gap-2 px-4 py-2 border border-white/20 rounded-xl cursor-pointer hover:bg-white/10 transition-colors text-sm font-medium text-white">
                <ImageIcon className="w-4 h-4" />
                Завантажити
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
              {formData.businessCardBackgroundImage && (
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, businessCardBackgroundImage: '' }))}
                  className="touch-target min-h-[44px] px-4 py-2 rounded-xl border border-white/20 bg-white/10 text-gray-300 hover:bg-white/15 hover:text-white transition-colors text-sm"
                >
                  Прибрати
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Слоган (під назвою)</label>
            <Input
              value={formData.slogan}
              onChange={(e) => setFormData({ ...formData, slogan: e.target.value })}
              placeholder="Наприклад: Ваша краса — наш пріоритет"
              className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-500 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
            />
            <p className="text-xs text-gray-500 mt-1">Якщо не вказати — використаємо опис бізнесу</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Додатково (коротко)</label>
            <textarea
              value={formData.additionalInfo}
              onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
              placeholder="1–3 рядки: особливості, як знайти, умови..."
              className={cn(
                'w-full px-3 py-2 rounded-lg bg-white/10 text-white placeholder-gray-500 resize-none',
                'border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 min-h-[92px]'
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Локація</label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Адреса (місто, вулиця...)"
              className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-500 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
            />
          </div>

          <details className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <summary className="cursor-pointer list-none select-none px-4 py-3 bg-white/5 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Соцмережі</span>
              <span className="text-xs text-gray-400">JSON або текст</span>
            </summary>
            <div className="p-4 space-y-2">
              <Input
                value={formData.socialMedia}
                onChange={(e) => setFormData({ ...formData, socialMedia: e.target.value })}
                placeholder='{"instagram":"@my","telegram":"https://t.me/..."}'
                className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-500 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
              />
              <p className="text-xs text-gray-500">
                Підтримується JSON: `instagram`, `facebook`, `telegram`, `tiktok`, `website`. Якщо не JSON — буде як “Соцмережі”.
              </p>
            </div>
          </details>

          <Button
            type="submit"
            disabled={isSaving}
            className="w-full min-h-[48px] px-4 py-3 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Збереження...' : 'Зберегти'}
          </Button>
        </form>

        {/* Preview */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden min-w-0">
          <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-white">Превʼю</div>
            <div className="text-xs text-gray-400 flex items-center gap-1.5">
              <CheckIcon className="w-4 h-4 text-emerald-400" />
              Як на `/booking/...`
            </div>
          </div>
          <div className="p-4">
            <div
              className="rounded-2xl overflow-hidden border border-white/10 relative min-h-[320px] flex items-center justify-center"
            >
              {formData.businessCardBackgroundImage ? (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${formData.businessCardBackgroundImage})` }}
                  aria-hidden
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0f172a] to-black" aria-hidden />
              )}
              <div className="absolute inset-0 bg-black/65" aria-hidden />

              <div className="relative z-10 text-center px-4 max-w-md">
                <div className="flex items-center justify-center mb-3">
                  {(business.logo || business.avatar) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(business.logo || business.avatar) as string}
                      alt={business.name}
                      className="w-12 h-12 rounded-2xl object-cover border border-white/15 bg-white/10"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white font-bold">
                      {(business.name || 'B').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="text-xl font-bold text-white mb-1">{business.name}</div>
                <div className="text-sm text-gray-200 mb-3">
                  {(formData.slogan || business.description || 'Професійні послуги високої якості').trim()}
                </div>
                {formData.additionalInfo?.trim() && (
                  <div className="text-xs text-gray-300 mb-3 whitespace-pre-line">
                    {formData.additionalInfo.trim()}
                  </div>
                )}
                {(formData.location?.trim() || socialsPreview) && (
                  <div className="flex flex-col items-center gap-2">
                    {formData.location?.trim() && (
                      <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-200 max-w-full truncate">
                        {formData.location.trim()}
                      </div>
                    )}
                    {socialsPreview && (
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {Object.keys(socialsPreview).slice(0, 3).map((k) => (
                          <span key={k} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-200">
                            {k === 'links' ? 'Соцмережі' : k}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
