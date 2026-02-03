import { prisma } from '@/lib/prisma'

/**
 * Сервіс для роботи з Центром управління та Реєстром телефонів
 */

interface RegisterBusinessData {
  businessId: string
  businessName: string
  email: string
  password: string // Хешований пароль
  phone?: string | null
  registrationType: 'telegram' | 'google' | 'standard'
  businessIdentifier?: string | null
  niche?: string | null
  customNiche?: string | null
}

/**
 * Реєструє бізнес в Центрі управління
 */
export async function registerBusinessInManagementCenter(data: RegisterBusinessData) {
  try {
    // Створюємо запис в Центрі управління
    const managementRecord = await prisma.managementCenter.create({
      data: {
        businessId: data.businessId,
        businessName: data.businessName,
        email: data.email,
        password: data.password, // Хешований пароль
        phone: data.phone || null,
        registrationType: data.registrationType,
        businessIdentifier: data.businessIdentifier || null,
        niche: data.niche || null,
        customNiche: data.customNiche || null,
        isActive: true,
      },
    })

    // Якщо є номер телефону - додаємо в Реєстр телефонів
    if (data.phone) {
      await prisma.phoneDirectory.create({
        data: {
          phone: data.phone,
          category: 'BUSINESS',
          businessId: data.businessId,
          businessName: data.businessName,
          isActive: true,
          isVerified: false, // Потрібно підтвердити
        },
      })
    }

    return managementRecord
  } catch (error) {
    console.error('Error registering business in Management Center:', error)
    // Не викидаємо помилку, щоб не зламати реєстрацію
    return null
  }
}

/**
 * Додає номер телефону клієнта в Реєстр телефонів
 */
export async function addClientPhoneToDirectory(
  phone: string,
  businessId: string,
  clientId?: string,
  clientName?: string
) {
  try {
    // Перевіряємо, чи номер вже існує
    const existing = await prisma.phoneDirectory.findFirst({
      where: {
        phone,
        category: 'CLIENT',
        businessId,
      },
    })

    if (existing) {
      // Оновлюємо існуючий запис
      return await prisma.phoneDirectory.update({
        where: { id: existing.id },
        data: {
          clientId: clientId || existing.clientId,
          clientName: clientName || existing.clientName,
          lastUsedAt: new Date(),
          isActive: true,
        },
      })
    }

    // Створюємо новий запис
    return await prisma.phoneDirectory.create({
      data: {
        phone,
        category: 'CLIENT',
        businessId,
        clientId: clientId || null,
        clientName: clientName || null,
        isActive: true,
        isVerified: false,
      },
    })
  } catch (error) {
    console.error('Error adding client phone to directory:', error)
    return null
  }
}

/**
 * Оновлює номер телефону бізнесу в Реєстрі
 */
export async function updateBusinessPhoneInDirectory(
  businessId: string,
  oldPhone: string | null,
  newPhone: string | null,
  businessName: string
) {
  try {
    // Видаляємо старий номер (якщо був)
    if (oldPhone) {
      await prisma.phoneDirectory.deleteMany({
        where: {
          phone: oldPhone,
          category: 'BUSINESS',
          businessId,
        },
      })
    }

    // Додаємо новий номер (якщо є)
    if (newPhone) {
      await prisma.phoneDirectory.upsert({
        where: {
          phone_category_businessId: {
            phone: newPhone,
            category: 'BUSINESS',
            businessId,
          },
        },
        update: {
          businessName,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          phone: newPhone,
          category: 'BUSINESS',
          businessId,
          businessName,
          isActive: true,
          isVerified: false,
        },
      })
    }

    // Оновлюємо в Центрі управління
    await prisma.managementCenter.update({
      where: { businessId },
      data: {
        phone: newPhone,
        updatedAt: new Date(),
      },
    })
  } catch (error) {
    console.error('Error updating business phone in directory:', error)
  }
}

/**
 * Отримує всі номери телефонів по категорії
 */
export async function getPhonesByCategory(category: 'BUSINESS' | 'CLIENT', businessId?: string) {
  try {
    return await prisma.phoneDirectory.findMany({
      where: {
        category,
        ...(businessId && { businessId }),
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  } catch (error) {
    console.error('Error getting phones by category:', error)
    return []
  }
}

/**
 * Оновлює дату останнього входу в Центрі управління
 */
export async function updateLastLogin(businessId: string) {
  try {
    await prisma.managementCenter.update({
      where: { businessId },
      data: {
        lastLoginAt: new Date(),
      },
    })
  } catch (error) {
    console.error('Error updating last login:', error)
  }
}

