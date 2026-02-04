import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Отримуємо інтеграції бізнесу
    const integrations = await prisma.socialIntegration.findMany({
      where: {
        businessId,
        isConnected: true,
      },
    })

    // Тут буде реальна логіка отримання повідомлень з соцмереж
    // Поки що повертаємо мок-дані для демонстрації
    const mockMessages = [
      {
        id: '1',
        platform: 'telegram' as const,
        senderName: 'Олександр Петренко',
        senderId: '123456',
        message: 'Добрий день! Чи можна записатися на завтра о 14:00?',
        timestamp: new Date().toISOString(),
        isRead: false,
      },
      {
        id: '2',
        platform: 'instagram' as const,
        senderName: 'Марія Коваленко',
        senderId: '789012',
        message: 'Дякую за чудовий сервіс! Коли наступний запис?',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        isRead: false,
      },
      {
        id: '3',
        platform: 'whatsapp' as const,
        senderName: 'Іван Сидоренко',
        senderId: '345678',
        message: 'Підтверджую запис на п\'ятницю',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        isRead: true,
      },
    ]

    // Якщо немає підключених інтеграцій, все одно показуємо мок-дані для демонстрації
    // В реальному застосунку тут буде перевірка підключених платформ
    const connectedPlatforms = integrations.length > 0 
      ? integrations.map(i => i.platform)
      : ['telegram', 'instagram', 'whatsapp'] // Для демонстрації
    
    const filteredMessages = mockMessages.filter(m => 
      connectedPlatforms.includes(m.platform)
    )

    // Сортуємо за часом (новіші першими)
    filteredMessages.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    return NextResponse.json(filteredMessages)
  } catch (error) {
    console.error('Error fetching social messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, messageId, platform, reply } = body

    if (!businessId || !messageId || !platform || !reply) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Тут буде реальна логіка відправки відповіді через API соцмережі
    // Поки що просто повертаємо успіх
    console.log('Sending reply:', { businessId, messageId, platform, reply })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending reply:', error)
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })
  }
}

