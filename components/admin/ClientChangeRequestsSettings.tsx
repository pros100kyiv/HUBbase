'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

function safeParse(raw?: string) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

type Settings = {
  enabled: boolean
  allowReschedule: boolean
  allowCancel: boolean
  requireMasterApproval: boolean
  minHoursBefore: number
}

export function ClientChangeRequestsSettings({
  businessId,
  currentSettings,
  onSave,
}: {
  businessId: string
  currentSettings?: string
  onSave?: (nextSettingsRaw: string) => void
}) {
  const initial = useMemo<Settings>(() => {
    const parsed = safeParse(currentSettings) || {}
    const cfg = parsed?.clientChangeRequests || {}
    return {
      enabled: cfg?.enabled !== false,
      allowReschedule: cfg?.allowReschedule !== false,
      allowCancel: cfg?.allowCancel !== false,
      requireMasterApproval: cfg?.requireMasterApproval !== false,
      minHoursBefore: Number.isFinite(Number(cfg?.minHoursBefore)) ? Math.max(0, Math.round(Number(cfg.minHoursBefore))) : 3,
    }
  }, [currentSettings])

  const [form, setForm] = useState<Settings>(initial)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        enabled: form.enabled,
        allowReschedule: form.allowReschedule,
        allowCancel: form.allowCancel,
        requireMasterApproval: form.requireMasterApproval,
        minHoursBefore: Math.max(0, Math.min(168, Math.round(Number(form.minHoursBefore) || 0))),
      }
      const res = await fetch(`/api/business/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientChangeRequests: payload }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Не вдалося зберегти налаштування')

      // Update parent state optimistically (so booking/manage reads new settings).
      try {
        const prev = safeParse(currentSettings) || {}
        const merged = { ...prev, clientChangeRequests: payload }
        onSave?.(JSON.stringify(merged))
      } catch {
        // ignore
      }

      toast({ title: 'Налаштування збережено', type: 'success' })
    } catch (e) {
      toast({ title: 'Помилка', description: e instanceof Error ? e.message : 'Не вдалося зберегти', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl p-4 md:p-6 card-glass border border-white/10">
      <h3 className="text-base font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
        Перенесення та скасування клієнтом
      </h3>
      <p className="text-xs text-gray-400 mt-1">
        Клієнт може надіслати запит на перенесення/скасування з підтвердженням майстра. Працює через посилання «Керування записом».
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Увімкнути</p>
            <p className="text-xs text-gray-400">Показувати клієнту можливість створити запит</p>
          </div>
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))} />
        </label>

        <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3', !form.enabled && 'opacity-60')}>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Дозволити перенесення</p>
              <p className="text-xs text-gray-400">Клієнт може попросити інший час</p>
            </div>
            <input
              type="checkbox"
              checked={form.allowReschedule}
              disabled={!form.enabled}
              onChange={(e) => setForm((p) => ({ ...p, allowReschedule: e.target.checked }))}
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Дозволити скасування</p>
              <p className="text-xs text-gray-400">Клієнт може попросити скасувати</p>
            </div>
            <input
              type="checkbox"
              checked={form.allowCancel}
              disabled={!form.enabled}
              onChange={(e) => setForm((p) => ({ ...p, allowCancel: e.target.checked }))}
            />
          </label>
        </div>

        <label className={cn('block rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3', !form.enabled && 'opacity-60')}>
          <span className="text-sm font-semibold text-white block">Мінімум годин до візиту</span>
          <span className="text-xs text-gray-400 block mt-0.5">Наприклад: 3 (зміни дозволені мінімум за 3 години)</span>
          <input
            type="number"
            min={0}
            max={168}
            value={form.minHoursBefore}
            disabled={!form.enabled}
            onChange={(e) => setForm((p) => ({ ...p, minHoursBefore: Number(e.target.value) }))}
            className="mt-2 w-full px-4 py-3 rounded-xl border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
          />
        </label>

        <label className={cn('flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3', !form.enabled && 'opacity-60')}>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Потрібне підтвердження</p>
            <p className="text-xs text-gray-400">Рекомендовано: так (майстер контролює всі зміни)</p>
          </div>
          <input
            type="checkbox"
            checked={form.requireMasterApproval}
            disabled={!form.enabled}
            onChange={(e) => setForm((p) => ({ ...p, requireMasterApproval: e.target.checked }))}
          />
        </label>

        <Button
          onClick={save}
          disabled={saving}
          className="w-full px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-all active:scale-[0.98]"
          style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
        >
          {saving ? 'Збереження...' : 'Зберегти'}
        </Button>
      </div>
    </div>
  )
}

