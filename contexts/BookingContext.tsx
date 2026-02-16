'use client'

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'

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
  /** Result of successful booking (for the final screen). */
  confirmation: {
    appointmentId: string
    createdAt: string
    status?: string | null
    startTime?: string | null
    endTime?: string | null
  } | null
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
  setConfirmation: (val: BookingState['confirmation']) => void
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
  confirmation: null,
}

const BookingContext = createContext<BookingContextType | undefined>(undefined)

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BookingState>(initialState)

  const setStep = useCallback((step: number) => {
    setState(prev => (prev.step === step ? prev : { ...prev, step }))
  }, [])

  const addService = useCallback((service: Service) => {
    setState(prev => ({
      ...prev,
      selectedServices: [...prev.selectedServices, service],
    }))
  }, [])

  const removeService = useCallback((serviceId: string) => {
    setState(prev => ({
      ...prev,
      selectedServices: prev.selectedServices.filter(s => s.id !== serviceId),
    }))
  }, [])

  const setBookingWithoutService = useCallback((value: boolean) => {
    setState(prev => ({
      ...prev,
      bookingWithoutService: value,
      ...(value ? { customServiceName: '' } : {}),
    }))
  }, [])

  const setCustomServiceName = useCallback((name: string) => {
    setState(prev => ({
      ...prev,
      customServiceName: name,
      ...(name.trim() ? { bookingWithoutService: false } : {}),
    }))
  }, [])

  const setMaster = useCallback((master: Master | null) => {
    setState(prev => ({ ...prev, selectedMaster: master }))
  }, [])

  const setDate = useCallback((date: Date | null) => {
    setState(prev => ({ ...prev, selectedDate: date }))
  }, [])

  const setTime = useCallback((time: string | null) => {
    setState(prev => ({ ...prev, selectedTime: time }))
  }, [])

  const setClientName = useCallback((name: string) => {
    setState(prev => ({ ...prev, clientName: name }))
  }, [])

  const setClientPhone = useCallback((phone: string) => {
    setState(prev => ({ ...prev, clientPhone: phone }))
  }, [])

  const setConfirmation = useCallback((val: BookingState['confirmation']) => {
    setState(prev => ({ ...prev, confirmation: val }))
  }, [])

  const setBusinessId = useCallback((id: string | null) => {
    setState(prev => {
      if (prev.businessId === id) return prev
      return { ...prev, businessId: id }
    })
  }, [])

  const reset = useCallback(() => {
    setState(initialState)
  }, [])

  const value = useMemo(
    () => ({
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
      setConfirmation,
      reset,
    }),
    [
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
      setConfirmation,
      reset,
    ]
  )

  return (
    <BookingContext.Provider value={value}>
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

