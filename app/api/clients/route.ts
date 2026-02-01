import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Спробуємо отримати клієнтів з таблиці Client
    try {
      const clients = await prisma.client.findMany({
        where: { businessId },
        include: {
          appointments: {
            where: {
              status: {
                in: ['Confirmed', 'Done'],
              },
            },
            orderBy: {
              startTime: 'desc',
            },
            take: 1,
          },
        },
        orderBy: {
          totalSpent: 'desc',
        },
      })

      return NextResponse.json(clients)
    } catch (error: any) {
      // Якщо таблиця Client не існує, групуюємо з appointments
      if (error?.message?.includes('does not exist') || error?.code === 'P2021') {
        const appointments = await prisma.appointment.findMany({
          where: {
            businessId,
            status: {
              in: ['Confirmed', 'Done'],
            },
          },
          orderBy: {
            startTime: 'desc',
          },
        })

        // Групуємо по телефону
        const clientsMap = new Map<string, any>()

        appointments.forEach((apt) => {
          const phone = apt.clientPhone
          const existing = clientsMap.get(phone) || {
            id: phone,
            name: apt.clientName,
            phone: apt.clientPhone,
            email: apt.clientEmail,
            totalAppointments: 0,
            totalSpent: 0,
            lifetimeValue: 0,
            retentionRate: 0,
            firstAppointmentDate: apt.startTime,
            lastAppointmentDate: apt.startTime,
            isActive: true,
          }

          existing.totalAppointments++
          existing.totalSpent += apt.customPrice || 0
          existing.lifetimeValue += apt.customPrice || 0

          if (new Date(apt.startTime) < new Date(existing.firstAppointmentDate)) {
            existing.firstAppointmentDate = apt.startTime
          }
          if (new Date(apt.startTime) > new Date(existing.lastAppointmentDate)) {
            existing.lastAppointmentDate = apt.startTime
          }

          clientsMap.set(phone, existing)
        })

        // Розраховуємо retention rate
        const clientsArray = Array.from(clientsMap.values()).map((client) => {
          const daysSinceLastVisit = Math.floor(
            (new Date().getTime() - new Date(client.lastAppointmentDate).getTime()) / (1000 * 60 * 60 * 24)
          )
          // Якщо останній візит був менше ніж 90 днів тому, клієнт активний
          const isActive = daysSinceLastVisit < 90
          const retentionRate = isActive ? 100 : Math.max(0, 100 - (daysSinceLastVisit - 90) / 10)

          return {
            ...client,
            isActive,
            retentionRate: Math.min(100, Math.max(0, retentionRate)),
          }
        })

        return NextResponse.json(clientsArray)
      }

      throw error
    }
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch clients',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

