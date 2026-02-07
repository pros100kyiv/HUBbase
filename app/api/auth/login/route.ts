import { NextResponse } from 'next/server'
import { authenticateBusiness } from '@/lib/auth'
import { z } from 'zod'
import { generateDeviceId, getClientIp, getUserAgent, isDeviceTrusted, addTrustedDevice } from '@/lib/utils/device'
import { prisma } from '@/lib/prisma'

const loginSchema = z.object({
  email: z.string().email('Невірний формат email'),
  password: z.string().min(1, 'Пароль обов\'язковий'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = loginSchema.parse(body)
    
    // Генеруємо deviceId для перевірки пристрою
    const clientIp = getClientIp(request)
    const userAgent = getUserAgent(request)
    const deviceId = generateDeviceId(clientIp, userAgent)

    console.log('Login attempt for email:', validated.email)

    const businessAuth = await authenticateBusiness(validated.email, validated.password)

    if (!businessAuth) {
      console.log('Authentication failed for email:', validated.email)
      // Перевіряємо, чи користувач існує
      const existingBusiness = await prisma.business.findUnique({
        where: { email: validated.email.toLowerCase().trim() },
        select: { id: true }
      })
      
      if (!existingBusiness) {
        return NextResponse.json(
          {
            error: 'Ви ще не зареєстровані. Будь ласка, зареєструйтесь спочатку.',
            needsRegistration: true
          },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        {
          error: 'Невірний пароль. Спробуйте ще раз або відновіть пароль.',
        },
        { status: 401 }
      )
    }

    // Перевіряємо чи бізнес активний
    if (businessAuth.isActive === false) {
      return NextResponse.json(
        { error: 'Ваш акаунт деактивовано' },
        { status: 403 }
      )
    }

    console.log('Login successful for business:', businessAuth.id)

    // Отримуємо бізнес з trustedDevices для перевірки пристрою
    const businessWithDevices = await prisma.business.findUnique({
      where: { id: businessAuth.id },
      select: { trustedDevices: true }
    })
    
    // Якщо ще немає довірених пристроїв — дозволяємо перший вхід (потім додамо пристрій)
    const trustedJson = businessWithDevices?.trustedDevices || null
    const hasTrustedDevices = trustedJson && trustedJson.trim() !== '' && trustedJson !== '[]'
    if (hasTrustedDevices) {
      const isTrusted = isDeviceTrusted(trustedJson, deviceId)
      if (!isTrusted) {
        return NextResponse.json({
          error: 'Це новий пристрій. Будь ласка, підтвердіть вхід через Telegram OAuth.',
          requiresOAuth: true,
          deviceId: deviceId
        }, { status: 403 })
      }
    }

    // Оновлюємо дату останнього входу в Центрі управління
    try {
      const { updateLastLogin } = await import('@/lib/services/management-center')
      await updateLastLogin(businessAuth.id)
    } catch (error) {
      console.error('Error updating last login:', error)
      // Не викидаємо помилку, щоб не зламати логін
    }

    // Додаємо пристрій до довірених при успішному вході
    const updatedTrustedDevices = addTrustedDevice(businessWithDevices?.trustedDevices || null, deviceId)
    await prisma.business.update({
      where: { id: businessAuth.id },
      data: { trustedDevices: updatedTrustedDevices }
    })

    // Синхронізуємо з ManagementCenter
    try {
      const { syncBusinessToManagementCenter } = await import('@/lib/services/management-center')
      await syncBusinessToManagementCenter(businessAuth.id)
    } catch (syncError) {
      console.error('Error syncing to ManagementCenter:', syncError)
    }

    // В продакшені тут буде JWT токен або сесія
    // Для простоти повертаємо бізнес (в реальному додатку використовуйте cookies/headers)
    return NextResponse.json({
      success: true,
      business: {
        id: businessAuth.id,
        name: businessAuth.name,
        slug: businessAuth.slug,
        email: businessAuth.email,
        phone: businessAuth.phone,
        address: businessAuth.address,
        description: businessAuth.description,
        logo: businessAuth.logo,
        avatar: (businessAuth as any).avatar || null,
        primaryColor: businessAuth.primaryColor,
        secondaryColor: businessAuth.secondaryColor,
        backgroundColor: businessAuth.backgroundColor,
        surfaceColor: businessAuth.surfaceColor,
        isActive: businessAuth.isActive,
        businessIdentifier: (businessAuth as any).businessIdentifier || null,
        profileCompleted: (businessAuth as any).profileCompleted || false,
        niche: (businessAuth as any).niche || null,
        customNiche: (businessAuth as any).customNiche || null,
        telegramChatId: (businessAuth as any).telegramChatId || null,
      },
      message: 'Вхід успішний',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Login error:', error)
    
    // Обробка помилок бази даних
    if (error instanceof Error) {
      if (error.message.includes('does not exist') || error.message.includes('admin_control_center')) {
        return NextResponse.json(
          { error: 'Система тимчасово недоступна. Будь ласка, спробуйте пізніше.' },
          { status: 503 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Помилка при вході. Будь ласка, спробуйте ще раз.' },
      { status: 500 }
    )
  }
}

