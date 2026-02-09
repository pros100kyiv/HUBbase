import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonSafe } from '@/lib/utils/json'
import { normalizeUaPhone } from '@/lib/utils/phone'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const businessId = searchParams.get('businessId')

    if (!query || !businessId) {
      return NextResponse.json({ error: 'Query and businessId are required' }, { status: 400 })
    }

    const searchTerm = query.trim().toLowerCase()
    const phoneNorm = normalizeUaPhone(query.trim())
    const isPhoneSearch = /^[\d+\s()-]+$/.test(query.trim()) && phoneNorm.startsWith('+380')
    const mode = 'insensitive' as const

    if (searchTerm.length < 2) {
      return NextResponse.json({ 
        appointments: [],
        clients: [],
        services: [],
        masters: []
      })
    }

    const appointmentPhoneOr = isPhoneSearch
      ? [
          { clientName: { contains: searchTerm, mode } },
          { clientPhone: { contains: searchTerm, mode } },
          { clientPhone: { contains: phoneNorm, mode } },
          { clientEmail: { contains: searchTerm, mode } },
          { notes: { contains: searchTerm, mode } },
        ]
      : [
          { clientName: { contains: searchTerm, mode } },
          { clientPhone: { contains: searchTerm, mode } },
          { clientEmail: { contains: searchTerm, mode } },
          { notes: { contains: searchTerm, mode } },
        ]

    const appointments = await prisma.appointment.findMany({
      where: {
        businessId,
        OR: appointmentPhoneOr,
      },
      select: {
        id: true,
        businessId: true,
        masterId: true,
        clientId: true,
        clientName: true,
        clientPhone: true,
        clientEmail: true,
        startTime: true,
        endTime: true,
        status: true,
        services: true,
        customServiceName: true,
        customPrice: true,
        notes: true,
        reminderSent: true,
        isRecurring: true,
        recurrencePattern: true,
        recurrenceEndDate: true,
        parentAppointmentId: true,
        isFromBooking: true,
        source: true,
        campaignId: true,
        createdAt: true,
        updatedAt: true,
        master: { select: { id: true, name: true } },
      },
      take: 10,
      orderBy: { startTime: 'desc' },
    })

    const clientPhoneOr = isPhoneSearch
      ? [
          { name: { contains: searchTerm, mode } },
          { phone: { contains: searchTerm, mode } },
          { phone: { contains: phoneNorm, mode } },
          { email: { contains: searchTerm, mode } },
        ]
      : [
          { name: { contains: searchTerm, mode } },
          { phone: { contains: searchTerm, mode } },
          { email: { contains: searchTerm, mode } },
        ]

    const clients = await prisma.client.findMany({
      where: {
        businessId,
        OR: clientPhoneOr,
      },
      take: 10,
      orderBy: {
        name: 'asc',
      },
    })

    // Search services
    const services = await prisma.service.findMany({
      where: {
        businessId,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      take: 10,
      orderBy: {
        name: 'asc',
      },
    })

    // Search masters
    const masters = await prisma.master.findMany({
      where: {
        businessId,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { bio: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      take: 10,
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(jsonSafe({
      appointments,
      clients,
      services,
      masters,
    }))
  } catch (error) {
    console.error('Error searching:', error)
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 })
  }
}

