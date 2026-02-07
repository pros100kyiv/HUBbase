import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonSafe } from '@/lib/utils/json'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const businessId = searchParams.get('businessId')

    if (!query || !businessId) {
      return NextResponse.json({ error: 'Query and businessId are required' }, { status: 400 })
    }

    const searchTerm = query.trim().toLowerCase()

    if (searchTerm.length < 2) {
      return NextResponse.json({ 
        appointments: [],
        clients: [],
        services: [],
        masters: []
      })
    }

    // Search appointments (select без procedureDone — працює до застосування міграції)
    const appointments = await prisma.appointment.findMany({
      where: {
        businessId,
        OR: [
          { clientName: { contains: searchTerm, mode: 'insensitive' } },
          { clientPhone: { contains: searchTerm, mode: 'insensitive' } },
          { clientEmail: { contains: searchTerm, mode: 'insensitive' } },
          { notes: { contains: searchTerm, mode: 'insensitive' } },
        ],
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

    // Search clients
    const clients = await prisma.client.findMany({
      where: {
        businessId,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { phone: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } },
        ],
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

