import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const mode = searchParams.get('mode') // 'chats' | null
    const chatId = searchParams.get('chatId')
    const platform = searchParams.get('platform')
    const limitRaw = parseInt(searchParams.get('limit') || '50', 10)
    const limit = Number.isNaN(limitRaw) || limitRaw < 1 ? 50 : Math.min(limitRaw, 100)

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Режим: список чатів (групування по platform + externalChatId)
    if (mode === 'chats') {
      const all = await prisma.socialInboxMessage.findMany({
        where: { businessId, externalChatId: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      })

      const chatMap = new Map<string, {
        platform: string
        externalChatId: string
        senderName: string
        senderId?: string
        lastMessage: string
        lastMessageAt: string
        unreadCount: number
        firstInboundId: string
      }>()

      for (const m of all) {
        const ec = m.externalChatId || ''
        if (!ec) continue
        const key = `${m.platform}::${ec}`
        const existing = chatMap.get(key)
        const isInbound = m.direction === 'inbound'

        if (!existing) {
          chatMap.set(key, {
            platform: m.platform,
            externalChatId: ec,
            senderName: isInbound ? m.senderName : 'Клієнт',
            senderId: m.senderId ?? undefined,
            lastMessage: m.message,
            lastMessageAt: m.createdAt.toISOString(),
            unreadCount: isInbound && !m.isRead ? 1 : 0,
            firstInboundId: isInbound ? m.id : '',
          })
        } else {
          if (new Date(m.createdAt) > new Date(existing.lastMessageAt)) {
            existing.lastMessage = m.message
            existing.lastMessageAt = m.createdAt.toISOString()
          }
          if (isInbound && !m.isRead) existing.unreadCount++
          if (isInbound) {
            if (!existing.firstInboundId) existing.firstInboundId = m.id
            if (existing.senderName === 'Клієнт') existing.senderName = m.senderName
          }
        }
      }

      const chats = Array.from(chatMap.values())
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
        .slice(0, limit)

      return NextResponse.json(chats)
    }

    // Режим: повна історія переписки по чату
    if (chatId && platform) {
      const rows = await prisma.socialInboxMessage.findMany({
        where: {
          businessId,
          externalChatId: chatId,
          platform,
        },
        orderBy: { createdAt: 'asc' },
        take: 200,
      })

      const thread = rows.map((m) => ({
        id: m.id,
        platform: m.platform as 'telegram' | 'instagram' | 'whatsapp' | 'facebook' | 'viber',
        direction: m.direction as 'inbound' | 'outbound',
        senderName: m.senderName,
        senderId: m.senderId ?? undefined,
        message: m.message,
        timestamp: m.createdAt.toISOString(),
        isRead: m.isRead,
      }))

      return NextResponse.json(thread)
    }

    // Режим за замовчуванням: плоский список вхідних (backward compat)
    const rows = await prisma.socialInboxMessage.findMany({
      where: { businessId, direction: 'inbound' },
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

// PATCH — позначити повідомлення/чат як прочитане
// ?messageId=X — одне повідомлення
// ?chatId=X&platform=Y — усі вхідні в чаті
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const messageId = searchParams.get('messageId')
    const chatId = searchParams.get('chatId')
    const platform = searchParams.get('platform')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 })
    }

    if (chatId && platform) {
      await prisma.socialInboxMessage.updateMany({
        where: {
          businessId,
          externalChatId: chatId,
          platform,
          direction: 'inbound',
        },
        data: { isRead: true },
      })
      return NextResponse.json({ success: true })
    }

    if (messageId) {
      await prisma.socialInboxMessage.updateMany({
        where: { id: messageId, businessId, direction: 'inbound' },
        data: { isRead: true },
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'messageId or (chatId and platform) required' }, { status: 400 })
  } catch (error) {
    console.error('Error marking message read:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

