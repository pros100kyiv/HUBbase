import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    const users = await prisma.telegramUser.findMany({
      where: {
        businessId,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        activatedAt: true,
        lastActivity: true,
        createdAt: true
      }
    })

    // Конвертуємо BigInt в string для JSON
    const usersWithStringIds = users.map(user => ({
      ...user,
      telegramId: user.telegramId.toString()
    }))

    return NextResponse.json(usersWithStringIds)
  } catch (error) {
    console.error('Error fetching Telegram users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

