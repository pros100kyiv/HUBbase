import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Отримуємо бізнес та токен бота
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        telegramBotToken: true
      }
    })

    if (!business || !business.telegramBotToken) {
      return NextResponse.json({ 
        botName: null,
        error: 'Telegram бот не налаштований' 
      }, { status: 200 })
    }

    // Отримуємо інформацію про бота з Telegram API
    try {
      const botInfoResponse = await fetch(`https://api.telegram.org/bot${business.telegramBotToken}/getMe`)
      if (botInfoResponse.ok) {
        const botInfo = await botInfoResponse.json()
        if (botInfo.ok && botInfo.result) {
          return NextResponse.json({ 
            botName: botInfo.result.username,
            botId: botInfo.result.id,
            firstName: botInfo.result.first_name
          })
        }
      }
    } catch (error) {
      console.error('Error fetching bot info from Telegram:', error)
    }

    // Якщо не вдалося отримати з Telegram API, повертаємо null
    return NextResponse.json({ 
      botName: null,
      error: 'Не вдалося отримати інформацію про бота' 
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching bot name:', error)
    return NextResponse.json({ error: 'Failed to fetch bot name' }, { status: 500 })
  }
}

