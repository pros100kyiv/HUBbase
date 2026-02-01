import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendTelegramNotification } from '@/lib/telegram'

/**
 * Створення розсилки
 * POST /api/telegram/broadcasts
 * Body: { businessId, title, message, targetRole?, scheduledAt? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessId, title, message, targetRole, scheduledAt, createdBy } = body

    if (!businessId || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: businessId, title, message' },
        { status: 400 }
      )
    }

    const broadcast = await prisma.telegramBroadcast.create({
      data: {
        businessId,
        title,
        message,
        targetRole: targetRole || null,
        status: scheduledAt ? 'scheduled' : 'draft',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        createdBy: createdBy || null,
      },
    })

    return NextResponse.json({ success: true, broadcast }, { status: 201 })
  } catch (error) {
    console.error('Error creating broadcast:', error)
    return NextResponse.json(
      { error: 'Failed to create broadcast', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Отримання списку розсилок
 * GET /api/telegram/broadcasts?businessId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })
    }

    const broadcasts = await prisma.telegramBroadcast.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(broadcasts)
  } catch (error) {
    console.error('Error fetching broadcasts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch broadcasts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

