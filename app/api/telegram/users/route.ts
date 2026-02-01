import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Отримання списку користувачів Telegram бота
 * GET /api/telegram/users?businessId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })
    }

    const users = await prisma.telegramUser.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(users.map(user => ({
      ...user,
      telegramId: user.telegramId.toString(),
    })))
  } catch (error) {
    console.error('Error fetching Telegram users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Оновлення користувача Telegram
 * PATCH /api/telegram/users
 * Body: { id, role?, permissions?, isActive?, notificationsEnabled? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, role, permissions, isActive, notificationsEnabled } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
    }

    const updateData: any = {}
    if (role !== undefined) updateData.role = role
    if (permissions !== undefined) updateData.permissions = JSON.stringify(permissions)
    if (isActive !== undefined) updateData.isActive = isActive
    if (notificationsEnabled !== undefined) updateData.notificationsEnabled = notificationsEnabled

    const user = await prisma.telegramUser.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, user: {
      ...user,
      telegramId: user.telegramId.toString(),
    }})
  } catch (error) {
    console.error('Error updating Telegram user:', error)
    return NextResponse.json(
      { error: 'Failed to update user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

