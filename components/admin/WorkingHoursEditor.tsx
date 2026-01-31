'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface WorkingHoursEditorProps {
  masterId: string
  businessId: string
  currentHours?: string
  onSave: (hours: string) => void
}

interface DaySchedule {
  enabled: boolean
  start: string
  end: string
}

interface WorkingHours {
  [key: string]: DaySchedule
}

const defaultHours: WorkingHours = {
  monday: { enabled: true, start: '09:00', end: '18:00' },
  tuesday: { enabled: true, start: '09:00', end: '18:00' },
  wednesday: { enabled: true, start: '09:00', end: '18:00' },
  thursday: { enabled: true, start: '09:00', end: '18:00' },
  friday: { enabled: true, start: '09:00', end: '18:00' },
  saturday: { enabled: false, start: '09:00', end: '18:00' },
  sunday: { enabled: false, start: '09:00', end: '18:00' },
}

const dayNames: Record<string, string> = {
  monday: 'Понеділок',
  tuesday: 'Вівторок',
  wednesday: 'Середа',
  thursday: 'Четвер',
  friday: 'П\'ятниця',
  saturday: 'Субота',
  sunday: 'Неділя',
}

export function WorkingHoursEditor({
  masterId,
  businessId,
  currentHours,
  onSave,
}: WorkingHoursEditorProps) {
  const [hours, setHours] = useState<WorkingHours>(defaultHours)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentHours) {
      try {
        const parsed = JSON.parse(currentHours)
        setHours({ ...defaultHours, ...parsed })
      } catch (e) {
        console.error('Error parsing working hours:', e)
      }
    }
  }, [currentHours])

  const updateDay = (day: string, field: keyof DaySchedule, value: boolean | string) => {
    setHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/masters/${masterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workingHours: JSON.stringify(hours),
        }),
      })

      if (response.ok) {
        onSave(JSON.stringify(hours))
        alert('Графік роботи збережено!')
      } else {
        alert('Помилка збереження')
      }
    } catch (error) {
      console.error('Error saving working hours:', error)
      alert('Помилка збереження')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader className="p-2 pb-1">
        <CardTitle className="text-sm font-black text-foreground dark:text-white">Графік роботи</CardTitle>
      </CardHeader>
      <CardContent className="p-2 space-y-1">
        {Object.entries(dayNames).map(([key, name]) => (
          <div key={key} className="flex items-center gap-1.5 p-1.5 rounded-candy-xs bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1.5 min-w-[90px]">
              <input
                type="checkbox"
                checked={hours[key].enabled}
                onChange={(e) => updateDay(key, 'enabled', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
              />
              <label className="text-xs font-bold text-foreground dark:text-white">{name}</label>
            </div>

            {hours[key].enabled && (
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="time"
                  value={hours[key].start}
                  onChange={(e) => updateDay(key, 'start', e.target.value)}
                  className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-candy-xs text-foreground dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">—</span>
                <input
                  type="time"
                  value={hours[key].end}
                  onChange={(e) => updateDay(key, 'end', e.target.value)}
                  className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-candy-xs text-foreground dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}

            {!hours[key].enabled && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Вихідний</span>
            )}
          </div>
        ))}

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-2 text-xs py-1.5 h-auto"
        >
          {saving ? 'Збереження...' : 'Зберегти графік'}
        </Button>
      </CardContent>
    </Card>
  )
}

