'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface Service {
  id: string
  name: string
  price: number
  duration: number
  category?: string
}

export interface Master {
  id: string
  name: string
  photo?: string
  bio?: string
  rating: number
  isActive?: boolean
}

export interface BookingState {
  businessId: string | null
  step: number
  selectedServices: Service[]
  /** Запис без вибору послуги (вартість після процедури) */
  bookingWithoutService: boolean
  /** Текст своєї послуги від клієнта (вартість після процедури) */
  customServiceName: string
  selectedMaster: Master | null
  selectedDate: Date | null
  selectedTime: string | null
  clientName: string
  clientPhone: string
}

interface BookingContextType {
  state: BookingState
  setBusinessId: (id: string | null) => void
  setStep: (step: number) => void
  addService: (service: Service) => void
  removeService: (serviceId: string) => void
  setBookingWithoutService: (value: boolean) => void
  setCustomServiceName: (name: string) => void
  setMaster: (master: Master | null) => void
  setDate: (date: Date | null) => void
  setTime: (time: string | null) => void
  setClientName: (name: string) => void
  setClientPhone: (phone: string) => void
  reset: () => void
}

const initialState: BookingState = {
  businessId: null,
  step: 0,
  selectedServices: [],
  bookingWithoutService: false,
  customServiceName: '',
  selectedMaster: null,
  selectedDate: null,
  selectedTime: null,
  clientName: '',
  clientPhone: '',
}

const BookingContext = createContext<BookingContextType | undefined>(undefined)

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BookingState>(initialState)

  const setStep = (step: number) => {
    setState(prev => ({ ...prev, step }))
  }

  const addService = (service: Service) => {
    setState(prev => ({
      ...prev,
      selectedServices: [...prev.selectedServices, service],
    }))
  }

  const removeService = (serviceId: string) => {
    setState(prev => ({
      ...prev,
      selectedServices: prev.selectedServices.filter(s => s.id !== serviceId),
    }))
  }

  const setBookingWithoutService = (value: boolean) => {
    setState(prev => ({
      ...prev,
      bookingWithoutService: value,
      ...(value ? { customServiceName: '' } : {}),
    }))
  }

  const setCustomServiceName = (name: string) => {
    setState(prev => ({
      ...prev,
      customServiceName: name,
      ...(name.trim() ? { bookingWithoutService: false } : {}),
    }))
  }

  const setMaster = (master: Master | null) => {
    setState(prev => ({ ...prev, selectedMaster: master }))
  }

  const setDate = (date: Date | null) => {
    setState(prev => ({ ...prev, selectedDate: date }))
  }

  const setTime = (time: string | null) => {
    setState(prev => ({ ...prev, selectedTime: time }))
  }

  const setClientName = (name: string) => {
    setState(prev => ({ ...prev, clientName: name }))
  }

  const setClientPhone = (phone: string) => {
    setState(prev => ({ ...prev, clientPhone: phone }))
  }

  const setBusinessId = useCallback((id: string | null) => {
    setState(prev => {
      // Оновлюємо тільки якщо значення змінилося
      if (prev.businessId === id) return prev
      return { ...prev, businessId: id }
    })
  }, [])

  const reset = () => {
    setState(initialState)
  }

  return (
    <BookingContext.Provider
      value={{
        state,
        setBusinessId,
        setStep,
        addService,
        removeService,
        setBookingWithoutService,
        setCustomServiceName,
        setMaster,
        setDate,
        setTime,
        setClientName,
        setClientPhone,
        reset,
      }}
    >
      {children}
    </BookingContext.Provider>
  )
}

export function useBooking() {
  const context = useContext(BookingContext)
  if (context === undefined) {
    throw new Error('useBooking must be used within a BookingProvider')
  }
  return context
}

