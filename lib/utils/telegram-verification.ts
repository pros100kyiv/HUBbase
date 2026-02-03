import { prisma } from '@/lib/prisma'

/**
 * Генерує 6-значний код підтвердження
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Створює код підтвердження для Telegram OAuth
 */
export async function createVerificationCode(data: {
  telegramId: bigint
  telegramData?: any
  action: 'login' | 'register'
  deviceId?: string
  businessId?: string
}): Promise<string> {
  // Генеруємо унікальний код
  let code: string
  let exists = true
  
  while (exists) {
    code = generateVerificationCode()
    const existing = await prisma.telegramVerification.findUnique({
      where: { code }
    })
    exists = !!existing
  }

  // Видаляємо старі невикористані коди для цього telegramId
  await prisma.telegramVerification.deleteMany({
    where: {
      telegramId: data.telegramId,
      verified: false,
      expiresAt: { lt: new Date() }
    }
  })

  // Створюємо новий код (термін дії 5 хвилин)
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
  
  await prisma.telegramVerification.create({
    data: {
      code: code!,
      telegramId: data.telegramId,
      telegramData: data.telegramData ? JSON.stringify(data.telegramData) : null,
      action: data.action,
      deviceId: data.deviceId || null,
      businessId: data.businessId || null,
      expiresAt
    }
  })

  return code!
}

/**
 * Перевіряє та використовує код підтвердження
 */
export async function verifyCode(code: string): Promise<{
  success: boolean
  verification?: any
  error?: string
}> {
  const verification = await prisma.telegramVerification.findUnique({
    where: { code }
  })

  if (!verification) {
    return { success: false, error: 'Невірний код підтвердження' }
  }

  if (verification.verified) {
    return { success: false, error: 'Цей код вже використано' }
  }

  if (verification.expiresAt < new Date()) {
    return { success: false, error: 'Код підтвердження прострочено' }
  }

  // Позначаємо код як використаний
  await prisma.telegramVerification.update({
    where: { id: verification.id },
    data: {
      verified: true,
      verifiedAt: new Date()
    }
  })

  return { success: true, verification }
}

/**
 * Відправляє код підтвердження в Telegram
 */
export async function sendVerificationCodeToTelegram(
  botToken: string,
  telegramId: bigint,
  code: string,
  action: 'login' | 'register'
): Promise<boolean> {
  try {
    const actionText = action === 'login' ? 'входу' : 'реєстрації'
    const message = `🔐 Код підтвердження для ${actionText}:\n\n` +
      `**${code}**\n\n` +
      `Введіть цей код на сайті для завершення ${actionText}.\n` +
      `Код дійсний 5 хвилин.`

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId.toString(),
        text: message,
        parse_mode: 'Markdown'
      })
    })

    const data = await response.json()
    return data.ok === true
  } catch (error) {
    console.error('Error sending verification code to Telegram:', error)
    return false
  }
}

