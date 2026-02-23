/**
 * GET /api/booking/telegram-invite?slug=xxx | businessId=xxx [&manageToken=xxx]
 * Повертає посилання на Telegram-бота для запису та сповіщень (публічний доступ).
 * Якщо manageToken передано — посилання веде в бот з показом підтвердження запису.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')?.trim()
    const businessId = searchParams.get('businessId')?.trim()
    const manageToken = searchParams.get('manageToken')?.trim()

    if (!slug && !businessId) {
      return NextResponse.json({ inviteLink: null, hasTelegram: false }, { status: 200 })
    }

    const business = await prisma.business.findFirst({
      where: slug ? { slug } : { id: businessId },
      select: {
        id: true,
        telegramBotToken: true,
        businessIdentifier: true,
      },
    })

    if (!business?.telegramBotToken || !business?.businessIdentifier) {
      return NextResponse.json({ inviteLink: null, hasTelegram: false }, { status: 200 })
    }

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${business.telegramBotToken}/getMe`
      )
      const data = await res.json().catch(() => ({}))
      const botUsername = data?.result?.username

      if (!botUsername) {
        return NextResponse.json({ inviteLink: null, hasTelegram: false }, { status: 200 })
      }

      // Після запису: посилання з start=booked_<token> — бот покаже "Ви записалися"
      const startPayload =
        manageToken && manageToken.length >= 20 && manageToken.length <= 56
          ? `booked_${manageToken}`
          : business.businessIdentifier

      const inviteLink = `https://t.me/${botUsername}?start=${encodeURIComponent(startPayload)}`
      return NextResponse.json({ inviteLink, hasTelegram: true }, { status: 200 })
    } catch {
      return NextResponse.json({ inviteLink: null, hasTelegram: false }, { status: 200 })
    }
  } catch (err) {
    console.error('telegram-invite error:', err)
    return NextResponse.json({ inviteLink: null, hasTelegram: false }, { status: 200 })
  }
}
