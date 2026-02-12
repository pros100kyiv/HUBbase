import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, messageId, platform, reply } = body

    if (!businessId || !messageId || !platform || typeof reply !== 'string' || !reply.trim()) {
      return NextResponse.json({ error: 'Missing required fields: businessId, messageId, platform, reply' }, { status: 400 })
    }

    const inboxMessage = await prisma.socialInboxMessage.findFirst({
      where: { id: messageId, businessId, direction: 'inbound' },
    })
    if (!inboxMessage || !inboxMessage.externalChatId) {
      return NextResponse.json({ error: 'Message not found or cannot reply' }, { status: 404 })
    }

    if (platform === 'telegram') {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { telegramBotToken: true },
      })
      if (!business?.telegramBotToken) {
        return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 400 })
      }

      const chatId = inboxMessage.externalChatId
      const replyText = reply.trim()
      const res = await fetch(`https://api.telegram.org/bot${business.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText,
          // Без parse_mode — текст від користувача може містити <, >, & і має відображатися як є
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.ok) {
        console.error('Telegram send error:', data)
        return NextResponse.json(
          { error: 'Failed to send in Telegram', details: data.description },
          { status: 502 }
        )
      }

      // Зберігаємо исхідне повідомлення в БД (дубль в кабінеті)
      await prisma.socialInboxMessage.create({
        data: {
          businessId,
          platform: 'telegram',
          direction: 'outbound',
          externalId: data.result?.message_id ? String(data.result.message_id) : null,
          externalChatId: chatId,
          senderId: null,
          senderName: 'Ви',
          message: replyText,
          isRead: true,
          replyToId: messageId,
        },
      })

      // Позначити вхідне як прочитане
      await prisma.socialInboxMessage.updateMany({
        where: { id: messageId, businessId },
        data: { isRead: true },
      })

      return NextResponse.json({ success: true })
    }

    if (platform === 'instagram') {
      const integration = await prisma.socialIntegration.findFirst({
        where: { businessId, platform: 'instagram', isConnected: true },
        select: { accessToken: true },
      })
      if (!integration?.accessToken) {
        return NextResponse.json({ error: 'Instagram not connected' }, { status: 400 })
      }

      const recipientId = inboxMessage.externalChatId
      const replyText = reply.trim()
      const sendRes = await fetch(
        `https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(integration.accessToken)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text: replyText },
          }),
        }
      )
      const sendData = (await sendRes.json().catch(() => ({}))) as {
        error?: { message: string; code?: number }
        message_id?: string
      }

      if (sendData.error) {
        console.error('Instagram send error:', sendData)
        return NextResponse.json(
          { error: 'Failed to send in Instagram', details: sendData.error?.message },
          { status: 502 }
        )
      }

      await prisma.socialInboxMessage.create({
        data: {
          businessId,
          platform: 'instagram',
          direction: 'outbound',
          externalId: sendData.message_id ?? undefined,
          externalChatId: recipientId,
          senderId: null,
          senderName: 'Ви',
          message: replyText,
          isRead: true,
          replyToId: messageId,
        },
      })

      await prisma.socialInboxMessage.updateMany({
        where: { id: messageId, businessId },
        data: { isRead: true },
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: `Reply for platform "${platform}" is not implemented yet` }, { status: 501 })
  } catch (error) {
    console.error('Error sending reply:', error)
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })
  }
}
