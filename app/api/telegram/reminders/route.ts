import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Створення нагадування
 * POST /api/telegram/reminders
 * Body: { businessId, message, targetType, clientId?, scheduledAt? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessId, message, targetType, clientId, scheduledAt, createdBy } = body

    if (!businessId || !message || !targetType) {
      return NextResponse.json(
        { error: 'Missing required fields: businessId, message, targetType' },
        { status: 400 }
      )
    }

    if (targetType === 'client' && !clientId) {
      return NextResponse.json(
        { error: 'clientId is required when targetType is "client"' },
        { status: 400 }
      )
    }

    const reminder = await prisma.telegramReminder.create({
      data: {
        businessId,
        message,
        targetType: targetType || 'all',
        clientId: targetType === 'client' ? clientId : null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: scheduledAt ? 'pending' : 'pending',
        createdBy: createdBy || null,
      },
      include: {
        client: targetType === 'client' ? {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        } : false,
      },
    })

    return NextResponse.json({ success: true, reminder }, { status: 201 })
  } catch (error) {
    console.error('Error creating reminder:', error)
    return NextResponse.json(
      { error: 'Failed to create reminder', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Отримання списку нагадувань
 * GET /api/telegram/reminders?businessId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })
    }

    const reminders = await prisma.telegramReminder.findMany({
      where: { businessId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(reminders)
  } catch (error) {
    console.error('Error fetching reminders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reminders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

