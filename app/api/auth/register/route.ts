import { NextResponse } from 'next/server'
import { createBusiness, generateSlug, hashPassword } from '@/lib/auth'
import { z } from 'zod'
import { generateDeviceId, getClientIp, getUserAgent, addTrustedDevice } from '@/lib/utils/device'
import { ensureAdminControlCenterTable } from '@/lib/database/ensure-admin-control-center'
import { prisma } from '@/lib/prisma'

const registerSchema = z.object({
  name: z.string().min(1, 'Назва обов\'язкова'),
  email: z.string().email('Невірний формат email'),
  password: z.string().min(6, 'Пароль має бути мінімум 6 символів'),
  phone: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    // Перевіряємо та створюємо таблицю admin_control_center, якщо вона не існує
    await ensureAdminControlCenterTable()
    
    const body = await request.json()
    const validated = registerSchema.parse(body)
    
    // Генеруємо deviceId для перевірки пристрою
    const clientIp = getClientIp(request)
    const userAgent = getUserAgent(request)
    const deviceId = generateDeviceId(clientIp, userAgent)

    // Перевіряємо, чи email вже існує - якщо так, спробуємо автоматично увійти
    const existingBusiness = await prisma.business.findUnique({
      where: { email: validated.email.toLowerCase().trim() }
    })

    if (existingBusiness) {
      // Перевіряємо пароль
      const { verifyPassword } = await import('@/lib/auth')
      const passwordMatch = existingBusiness.password 
        ? await verifyPassword(validated.password, existingBusiness.password)
        : false

      if (passwordMatch) {
        // Автоматичний вхід - додаємо пристрій до довірених
        const updatedTrustedDevices = addTrustedDevice(existingBusiness.trustedDevices, deviceId)
        await prisma.business.update({
          where: { id: existingBusiness.id },
          data: { trustedDevices: updatedTrustedDevices }
        })

        // Синхронізуємо з ManagementCenter
        try {
          const { syncBusinessToManagementCenter } = await import('@/lib/services/management-center')
          await syncBusinessToManagementCenter(existingBusiness.id)
        } catch (syncError) {
          console.error('Error syncing to ManagementCenter:', syncError)
        }

        return NextResponse.json({
          success: true,
          business: {
            id: existingBusiness.id,
            name: existingBusiness.name,
            slug: existingBusiness.slug,
            email: existingBusiness.email,
            phone: existingBusiness.phone,
            address: existingBusiness.address,
            description: existingBusiness.description,
            logo: existingBusiness.logo,
            avatar: existingBusiness.avatar,
            primaryColor: existingBusiness.primaryColor,
            secondaryColor: existingBusiness.secondaryColor,
            backgroundColor: existingBusiness.backgroundColor,
            surfaceColor: existingBusiness.surfaceColor,
            isActive: existingBusiness.isActive,
            businessIdentifier: existingBusiness.businessIdentifier,
            profileCompleted: existingBusiness.profileCompleted,
            niche: existingBusiness.niche,
            customNiche: existingBusiness.customNiche,
          },
          message: 'Успішний вхід в існуючий акаунт',
          isLogin: true
        }, { status: 200 })
      } else {
        // Пароль не співпадає
        return NextResponse.json(
          { error: 'Email вже зареєстровано. Невірний пароль. Спробуйте увійти або використайте інший email.' },
          { status: 409 }
        )
      }
    }

    // Генеруємо slug з назви
    const slug = generateSlug(validated.name)

    // Створюємо бізнес (автоматично реєструється в Центрі управління)
    const business = await createBusiness({
      name: validated.name,
      email: validated.email,
      password: validated.password,
      slug: slug,
      phone: validated.phone || null,
    })

    // Додаємо пристрій до довірених при реєстрації
    const updatedTrustedDevices = addTrustedDevice(business.trustedDevices, deviceId)
    const updatedBusiness = await prisma.business.update({
      where: { id: business.id },
      data: { trustedDevices: updatedTrustedDevices }
    })

    // Синхронізуємо з ManagementCenter (повна синхронізація)
    try {
      const { syncBusinessToManagementCenter } = await import('@/lib/services/management-center')
      await syncBusinessToManagementCenter(business.id)
    } catch (syncError) {
      console.error('Error syncing to ManagementCenter:', syncError)
      // Не викидаємо помилку, щоб не зламати реєстрацію
    }

    // Перевіряємо, чи дані синхронізовані в admin_control_center (через тригер)
    // Тригер автоматично створить запис при INSERT в Business

    // Повертаємо успішну відповідь з даними бізнесу
    return NextResponse.json({
      success: true,
      business: {
        id: updatedBusiness.id,
        name: updatedBusiness.name,
        slug: updatedBusiness.slug,
        email: updatedBusiness.email,
        phone: updatedBusiness.phone,
        address: updatedBusiness.address,
        description: updatedBusiness.description,
        logo: updatedBusiness.logo,
        avatar: updatedBusiness.avatar,
        primaryColor: updatedBusiness.primaryColor,
        secondaryColor: updatedBusiness.secondaryColor,
        backgroundColor: updatedBusiness.backgroundColor,
        surfaceColor: updatedBusiness.surfaceColor,
        isActive: updatedBusiness.isActive,
        businessIdentifier: updatedBusiness.businessIdentifier,
        profileCompleted: updatedBusiness.profileCompleted,
        niche: updatedBusiness.niche,
        customNiche: updatedBusiness.customNiche,
      },
      message: 'Бізнес успішно зареєстровано та синхронізовано з базою даних',
      isLogin: false
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    // Перевірка на дублікат email
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Email вже зареєстровано. Спробуйте увійти або використайте інший email.' },
        { status: 409 }
      )
    }

    // Обробка помилок бази даних
    if (error instanceof Error) {
      // Якщо таблиця не існує - дружнє повідомлення
      if (error.message.includes('does not exist') || error.message.includes('admin_control_center')) {
        console.error('Database table missing:', error)
        return NextResponse.json(
          { error: 'Система тимчасово недоступна. Будь ласка, спробуйте пізніше або зверніться до підтримки.' },
          { status: 503 }
        )
      }
      
      // Якщо користувач не зареєстрований
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Ви ще не зареєстровані. Будь ласка, зареєструйтесь спочатку.' },
          { status: 404 }
        )
      }
    }

    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Помилка при реєстрації. Будь ласка, спробуйте ще раз або зверніться до підтримки.' },
      { status: 500 }
    )
  }
}

