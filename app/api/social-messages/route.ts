import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Реальні повідомлення з БД (тільки вхідні — для відображення в кабінеті)
    const rows = await prisma.socialInboxMessage.findMany({
      where: {
        businessId,
        direction: 'inbound',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const messages = rows.map((m) => ({
      id: m.id,
      platform: m.platform as 'telegram' | 'instagram' | 'whatsapp' | 'facebook' | 'viber',
      senderName: m.senderName,
      senderId: m.senderId ?? undefined,
      message: m.message,
      timestamp: m.createdAt.toISOString(),
      isRead: m.isRead,
      externalChatId: m.externalChatId ?? undefined,
    }))

    return NextResponse.json(messages)
  } catch (error) {
    console.error('Error fetching social messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

// PATCH — позначити повідомлення як прочитане
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const messageId = searchParams.get('messageId')
    if (!businessId || !messageId) {
      return NextResponse.json({ error: 'businessId and messageId required' }, { status: 400 })
    }
    await prisma.socialInboxMessage.updateMany({
      where: { id: messageId, businessId, direction: 'inbound' },
      data: { isRead: true },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking message read:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

