import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { prisma } from '@/lib/prisma'
import { Telegram } from 'telegraf'
import sharp from 'sharp'

/**
 * Встановлює фото Telegram бота з логотипу проекту (app/icon.svg).
 * POST /api/telegram/set-bot-photo
 * Body: { businessId: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const businessId = body?.businessId

    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId обов\'язковий' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, telegramBotToken: true },
    })
    if (!business?.telegramBotToken) {
      return NextResponse.json({ success: false, error: 'Токен бота не налаштовано' }, { status: 400 })
    }

    const iconPath = join(process.cwd(), 'app', 'icon.svg')
    if (!existsSync(iconPath)) {
      return NextResponse.json({ success: false, error: 'Файл app/icon.svg не знайдено' }, { status: 404 })
    }

    const svgBuffer = readFileSync(iconPath)
    const pngBuffer = await sharp(svgBuffer)
      .png()
      .resize(512, 512)
      .toBuffer()

    const telegram = new Telegram(business.telegramBotToken, { webhookReply: false })
    await (telegram as any).callApi('setMyProfilePhoto', {
      photo: { source: pngBuffer, filename: 'icon.png' },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    const msg = err?.response?.body?.description || err?.message || String(err)
    console.error('set-bot-photo error:', msg)
    return NextResponse.json(
      { success: false, error: msg.includes('photo isn\'t specified')
        ? 'Telegram API тимчасово не приймає фото. Завантажте public/icon.png вручну в @BotFather → Edit Bot → Edit Botpic.'
        : msg },
      { status: 500 }
    )
  }
}
