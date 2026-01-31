'use client'

import { useEffect, useState } from 'react'
import { format, startOfDay, addMinutes, isSameDay } from 'date-fns'
import { uk } from 'date-fns/locale'
import { DailyJournal } from '@/components/admin/DailyJournal'

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-title text-primary mb-8">
          АДМІН ПАНЕЛЬ
        </h1>
        <DailyJournal />
      </div>
    </div>
  )
}




