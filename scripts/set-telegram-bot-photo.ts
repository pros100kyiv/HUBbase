#!/usr/bin/env tsx
import 'dotenv/config'

/**
 * Встановлює фото Telegram бота з логотипу проекту (app/icon.svg).
 * Конвертує SVG у PNG, зберігає public/icon.png та викликає Telegram API setMyProfilePhoto.
 * Якщо API повертає помилку, використовуйте збережений public/icon.png вручну в @BotFather:
 * Edit Bot → Edit Botpic → завантажте icon.png.
 *
 * Використання:
 *   npm run telegram:set-photo [businessId]
 *   npm run telegram:set-photo <businessId>   — для бота конкретного бізнесу
 */

import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import { Telegram } from 'telegraf'

const prisma = new PrismaClient()

const DEFAULT_BOT_TOKEN = process.env.DEFAULT_TELEGRAM_BOT_TOKEN || '8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo'

async function setBotPhoto(token: string, pngBuffer: Buffer): Promise<boolean> {
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}` || '').replace(/\/$/, '')
  const photoUrl = baseUrl ? `${baseUrl}/icon.png` : null

  const telegram = new Telegram(token, { webhookReply: false })

  // 1) Спроба через multipart (буфер)
  try {
    await (telegram as any).callApi('setMyProfilePhoto', {
      photo: { source: pngBuffer, filename: 'icon.png' },
    })
    return true
  } catch (e1: any) {
    const msg = e1?.response?.body?.description || e1?.message || ''
    if (photoUrl && (msg.includes('photo isn\'t specified') || msg.includes('Bad Request'))) {
      // 2) Спроба через URL: Telegraf сам завантажить файл з URL і відправить multipart
      try {
        await (telegram as any).callApi('setMyProfilePhoto', {
          photo: { url: photoUrl, filename: 'icon.png' },
        })
        return true
      } catch (e2: any) {
        const msg2 = e2?.response?.body?.description || e2?.message || ''
        console.error('Помилка Telegram API (URL):', msg2 || e2)
      }
    } else {
      console.error('Помилка Telegram API:', msg || e1)
    }
    return false
  }
}

async function main() {
  let token = DEFAULT_BOT_TOKEN
  const businessId = process.argv[2]

  if (businessId) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, telegramBotToken: true },
    })
    if (!business) {
      console.error('❌ Бізнес не знайдено:', businessId)
      process.exit(1)
    }
    if (business.telegramBotToken) {
      token = business.telegramBotToken
      console.log('📋 Бізнес:', business.name, `(${businessId})\n`)
    }
  }

  const iconSvgPath = join(process.cwd(), 'app', 'icon.svg')
  if (!existsSync(iconSvgPath)) {
    console.error('❌ Файл логотипу не знайдено: app/icon.svg')
    process.exit(1)
  }

  console.log('🖼️  Конвертація логотипу проекту (SVG → PNG)...')

  let sharp: typeof import('sharp')
  try {
    sharp = (await import('sharp')).default
  } catch {
    console.error('❌ Потрібен пакет sharp. Встановіть: npm install sharp --save-dev')
    process.exit(1)
  }

  const svgBuffer = readFileSync(iconSvgPath)
  const pngBuffer = await sharp(svgBuffer)
    .png()
    .resize(512, 512) // Telegram рекомендує 512x512 для фото профілю
    .toBuffer()

  const publicIconPath = join(process.cwd(), 'public', 'icon.png')
  writeFileSync(publicIconPath, pngBuffer)
  console.log('💾 Збережено логотип як public/icon.png (для ручного завантаження в @BotFather при потребі).\n')

  console.log('📤 Встановлення фото бота в Telegram...')

  const ok = await setBotPhoto(token, pngBuffer)
  await prisma.$disconnect()

  if (ok) {
    console.log('✅ Фото бота оновлено: тепер використовується логотип проекту (Xbase).\n')
  } else {
    console.log('💡 Встановіть фото вручну: відкрийте @BotFather → ваш бот → Edit Bot → Edit Botpic → завантажте public/icon.png\n')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
