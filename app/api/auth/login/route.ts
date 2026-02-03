import { NextResponse } from 'next/server'
import { authenticateBusiness } from '@/lib/auth'
import { z } from 'zod'
import { generateDeviceId, getClientIp, getUserAgent, isDeviceTrusted, addTrustedDevice } from '@/lib/utils/device'

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

    // Auto-create test business if it doesn't exist (only for test email)
    const TEST_EMAIL = 'admin@045barbershop.com'
    const TEST_PASSWORD = 'password123'
    
    if (validated.email.toLowerCase() === TEST_EMAIL.toLowerCase()) {
      const { prisma } = await import('@/lib/prisma')
      const { createBusiness } = await import('@/lib/auth')
      
      const existing = await prisma.business.findUnique({
        where: { email: TEST_EMAIL.toLowerCase() },
      })
      
      if (!existing) {
        console.log('Auto-creating test business...')
        const testBusiness = await createBusiness({
          name: '5 Barbershop',
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          slug: '045-barbershop',
        })
        console.log('Test business created automatically')
        // КРИТИЧНО ВАЖЛИВО: createBusiness() вже синхронізує, але переконаємося
        try {
          const { syncBusinessToManagementCenter } = await import('@/lib/services/management-center')
          await syncBusinessToManagementCenter(testBusiness.id)
        } catch (error) {
          console.error('КРИТИЧНА ПОМИЛКА: Не вдалося синхронізувати тестовий бізнес в ManagementCenter:', error)
        }
      }
    }

    const businessAuth = await authenticateBusiness(validated.email, validated.password)

    if (!businessAuth) {
      console.log('Authentication failed for email:', validated.email)
      // Перевіряємо, чи користувач існує
      const { prisma } = await import('@/lib/prisma')
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
    const { prisma } = await import('@/lib/prisma')
    const businessWithDevices = await prisma.business.findUnique({
      where: { id: businessAuth.id },
      select: { trustedDevices: true }
    })
    
    // Перевіряємо, чи це новий пристрій
    const isTrusted = isDeviceTrusted(businessWithDevices?.trustedDevices || null, deviceId)
    
    if (!isTrusted) {
      // Якщо це новий пристрій - вимагаємо OAuth підтвердження
      return NextResponse.json({
        error: 'Це новий пристрій. Будь ласка, підтвердіть вхід через Telegram OAuth.',
        requiresOAuth: true,
        deviceId: deviceId
      }, { status: 403 })
    }

    // Оновлюємо дату останнього входу в Центрі управління
    try {
      const { updateLastLogin } = await import('@/lib/services/management-center')
      await updateLastLogin(businessAuth.id)
    } catch (error) {
      console.error('Error updating last login:', error)
      // Не викидаємо помилку, щоб не зламати логін
    }

    // В продакшені тут буде JWT токен або сесія
    // Для простоти повертаємо бізнес (в реальному додатку використовуйте cookies/headers)
    return NextResponse.json({
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

