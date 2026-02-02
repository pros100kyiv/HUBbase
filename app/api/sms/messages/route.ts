import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const limit = parseInt(searchParams.get('limit') || '5')
    
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Отримуємо останні SMS повідомлення
    const smsMessages = await prisma.sMSMessage.findMany({
      where: {
        businessId
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    // Формуємо повідомлення
    const messages = smsMessages.map(msg => ({
      id: msg.id,
      phone: msg.phone,
      message: msg.message,
      status: msg.status,
      createdAt: msg.createdAt.toISOString(),
      clientName: msg.client?.name || undefined
    }))

    // Рахуємо непрочитані (pending)
    const unreadCount = await (prisma as any).sMSMessage.count({
      where: {
        businessId,
        status: 'pending'
      }
    })

    return NextResponse.json({
      messages,
      unreadCount
    })
  } catch (error) {
    console.error('Error fetching SMS messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

