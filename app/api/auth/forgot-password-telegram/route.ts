import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { isValidTelegramLoginData } from '@/lib/utils/telegram-auth'
import { getClientIp } from '@/lib/utils/device'
import { checkRateLimit } from '@/lib/utils/rate-limit'

/**
 * Відновлення паролю через Telegram: підтверджуємо особу через Telegram OAuth,
 * знаходимо бізнес за telegramId, генеруємо токен і повертаємо посилання на сторінку встановлення нового пароля.
 */
export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request) || 'unknown'
    const rateLimit = checkRateLimit({
      key: `forgot-password-telegram:${clientIp}`,
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
    })
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: 'Забагато запитів. Спробуйте трохи пізніше.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } }
      )
    }

    const body = await request.json()
    const telegramData = body.telegramData

    if (!telegramData?.id) {
      return NextResponse.json(
        { error: 'Дані Telegram не надано' },
        { status: 400 }
      )
    }

    const botToken =
      process.env.DEFAULT_TELEGRAM_BOT_TOKEN ||
      process.env.TELEGRAM_BOT_TOKEN ||
      ''
    if (!botToken) {
      return NextResponse.json(
        { error: 'Telegram бот не налаштований' },
        { status: 500 }
      )
    }

    if (!isValidTelegramLoginData(telegramData, botToken)) {
      return NextResponse.json(
        { error: 'Невірний підпис Telegram' },
        { status: 401 }
      )
    }

    const telegramId = BigInt(telegramData.id)

    // Шукаємо бізнес за Telegram (як у telegram-oauth)
    let business = await prisma.business.findUnique({
      where: { telegramId },
      select: { id: true, email: true },
    })

    if (!business) {
      const telegramUser = await prisma.telegramUser.findUnique({
        where: { telegramId },
        include: { business: true },
      })
      if (telegramUser?.business) {
        business = { id: telegramUser.business.id, email: telegramUser.business.email }
      }
    }

    if (!business) {
      return NextResponse.json(
        { error: 'Бізнес з цим Telegram-акаунтом не знайдено. Спочатку увійдіть або зареєструйтесь через Telegram.' },
        { status: 404 }
      )
    }

    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpiry = new Date()
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1)

    await prisma.business.update({
      where: { id: business.id },
      data: { resetToken, resetTokenExpiry },
      select: { id: true },
    })

    const resetUrl = `/reset-password?token=${resetToken}`

    return NextResponse.json({
      success: true,
      resetUrl,
      message: 'Перейдіть за посиланням, щоб встановити новий пароль.',
    })
  } catch (error) {
    console.error('Forgot password (Telegram) error:', error)
    return NextResponse.json(
      { error: 'Помилка при відновленні паролю через Telegram' },
      { status: 500 }
    )
  }
}
