'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useBooking, Master } from '@/contexts/BookingContext'
import { Button } from '@/components/ui/button'

interface MasterStepProps {
  businessId?: string
}

// Функція для визначення статі за ім'ям (українські імена)
const getGenderFromName = (name: string): 'male' | 'female' => {
  const femaleEndings = ['а', 'я', 'ія', 'іна', 'ка', 'на', 'ла', 'ра', 'са', 'та', 'ва', 'ша', 'ща']
  const nameLower = name.toLowerCase().trim()
  const lastChar = nameLower[nameLower.length - 1]
  
  // Перевірка на жіночі закінчення
  if (femaleEndings.some(ending => nameLower.endsWith(ending))) {
    return 'female'
  }
  
  // За замовчуванням чоловік
  return 'male'
}

// Компонент аватара
const AvatarIcon = ({ gender, size = 64 }: { gender: 'male' | 'female', size?: number }) => {
  if (gender === 'female') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="20" r="12" fill="#60A5FA" />
        <path d="M16 52 C16 42, 24 36, 32 36 C40 36, 48 42, 48 52" stroke="#60A5FA" strokeWidth="4" fill="none" />
        <path d="M20 24 Q24 20, 28 24" stroke="#3B82F6" strokeWidth="2" fill="none" />
        <path d="M36 24 Q40 20, 44 24" stroke="#3B82F6" strokeWidth="2" fill="none" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="18" r="12" fill="#60A5FA" />
      <path d="M16 52 C16 42, 24 36, 32 36 C40 36, 48 42, 48 52" stroke="#60A5FA" strokeWidth="4" fill="none" />
      <rect x="26" y="22" width="12" height="4" rx="2" fill="#3B82F6" />
    </svg>
  )
}

export function MasterStep({ businessId }: MasterStepProps) {
  const { state, setMaster, setStep } = useBooking()
  const [masters, setMasters] = useState<Master[]>([])

  useEffect(() => {
    if (!businessId) return
    fetch(`/api/masters?businessId=${businessId}`)
      .then(res => res.json())
      .then(data => {
        // Filter only active masters
        const activeMasters = data.filter((master: Master) => master.isActive !== false)
        setMasters(activeMasters)
      })
      .catch(error => {
        console.error('Error loading masters:', error)
        setMasters([])
      })
  }, [businessId])

  const isAvailableToday = (masterId: string) => {
    // This would check actual availability - simplified for now
    return true
  }

  return (
    <div className="min-h-screen bg-gray-900 dark:bg-gray-950 py-6 px-3">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-black mb-4 text-center text-white">
          ОБЕРІТЬ СПЕЦІАЛІСТА
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {masters.map((master) => {
            const available = isAvailableToday(master.id)
            const gender = getGenderFromName(master.name)
            return (
              <div
                key={master.id}
                className={`bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-candy-sm p-4 cursor-pointer transition-all hover:bg-white/15 dark:hover:bg-white/10 ${
                  state.selectedMaster?.id === master.id ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-white/20 dark:bg-white/15' : ''
                }`}
                onClick={() => setMaster(master)}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-3">
                    <div
                      className={`w-20 h-20 md:w-24 md:h-24 rounded-full border-2 ${
                        available ? 'border-blue-400' : 'border-gray-500'
                      } flex items-center justify-center bg-gray-800 dark:bg-gray-900 overflow-hidden`}
                    >
                      {master.photo ? (
                        <Image
                          src={master.photo}
                          alt={master.name}
                          width={96}
                          height={96}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center">
                          <AvatarIcon gender={gender} size={64} />
                        </div>
                      )}
                    </div>
                    {/* Status Ring */}
                    <div
                      className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-gray-900 dark:border-gray-950 ${
                        available ? 'bg-green-500' : 'bg-gray-500'
                      }`}
                    />
                  </div>
                  <h3 className="text-base font-black mb-1 text-white">{master.name}</h3>
                  {master.bio && (
                    <p className="text-xs mb-2 line-clamp-2 text-white/70">{master.bio}</p>
                  )}
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-yellow-400 dark:text-yellow-300">★</span>
                    <span className="text-xs text-white/80">{master.rating.toFixed(1)}</span>
                  </div>
                  <p
                    className={`text-xs ${
                      available ? 'text-green-400' : 'text-gray-500'
                    }`}
                  >
                    {available ? 'Доступний' : 'Недоступний'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(1)} className="btn-secondary flex-1">
            Назад
          </Button>
          <Button
            onClick={() => setStep(3)}
            disabled={!state.selectedMaster}
            className="btn-primary flex-1"
          >
            Далі
          </Button>
        </div>
      </div>
    </div>
  )
}

