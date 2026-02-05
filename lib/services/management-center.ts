import { prisma } from '@/lib/prisma'

/**
 * Сервіс для роботи з Центром управління та Реєстром телефонів
 */

interface RegisterBusinessData {
  businessId: string
  business: any // Повний об'єкт Business для дублювання
  registrationType: 'telegram' | 'google' | 'standard'
}

/**
 * Синхронізує всі дані Business в ManagementCenter (ПОВНЕ ДУБЛЮВАННЯ)
 */
export async function syncBusinessToManagementCenter(businessId: string) {
  try {
    // Перевіряємо, чи існує таблиця ManagementCenter
    try {
      await prisma.$queryRaw`SELECT 1 FROM "ManagementCenter" LIMIT 1`
    } catch (tableError: any) {
      if (tableError?.message?.includes('does not exist') || tableError?.code === '42P01') {
        console.warn('ManagementCenter table does not exist, skipping sync')
        return null
      }
      throw tableError
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
    })

    if (!business) {
      console.warn('Business not found for sync:', businessId)
      return null
    }

    // Оновлюємо або створюємо запис в Центрі управління
    const managementRecord = await prisma.managementCenter.upsert({
      where: { businessId },
      update: {
        // Синхронізуємо ВСІ дані
        name: business.name,
        slug: business.slug,
            email: business.email,
            password: business.password,
            resetToken: business.resetToken,
            resetTokenExpiry: business.resetTokenExpiry,
            googleId: business.googleId,
        telegramId: business.telegramId,
        phone: business.phone,
        address: business.address,
        description: business.description,
        logo: business.logo,
        avatar: business.avatar,
        primaryColor: business.primaryColor,
        secondaryColor: business.secondaryColor,
        backgroundColor: business.backgroundColor,
        surfaceColor: business.surfaceColor,
        hideRevenue: business.hideRevenue,
        isActive: business.isActive,
        niche: business.niche,
        customNiche: business.customNiche,
        businessIdentifier: business.businessIdentifier,
        profileCompleted: business.profileCompleted,
        settings: business.settings,
        businessCardBackgroundImage: business.businessCardBackgroundImage,
        slogan: business.slogan,
        additionalInfo: business.additionalInfo,
        socialMedia: business.socialMedia,
        workingHours: business.workingHours,
        location: business.location,
        telegramBotToken: business.telegramBotToken,
        telegramChatId: business.telegramChatId,
        telegramNotificationsEnabled: business.telegramNotificationsEnabled,
        telegramSettings: business.telegramSettings,
        aiChatEnabled: business.aiChatEnabled,
        aiProvider: business.aiProvider,
        aiApiKey: business.aiApiKey,
        aiSettings: business.aiSettings,
        smsProvider: business.smsProvider,
        smsApiKey: business.smsApiKey,
        smsSender: business.smsSender,
        emailProvider: business.emailProvider,
        emailApiKey: business.emailApiKey,
        emailFrom: business.emailFrom,
        emailFromName: business.emailFromName,
        paymentProvider: business.paymentProvider,
        paymentApiKey: business.paymentApiKey,
        paymentMerchantId: business.paymentMerchantId,
        paymentEnabled: business.paymentEnabled,
        remindersEnabled: business.remindersEnabled,
        reminderSmsEnabled: business.reminderSmsEnabled,
        reminderEmailEnabled: business.reminderEmailEnabled,
        updatedAt: new Date(),
      },
      create: {
        businessId: business.id,
        // ПОВНЕ ДУБЛЮВАННЯ ВСІХ ДАНИХ
        name: business.name,
        slug: business.slug,
            email: business.email,
            password: business.password,
            resetToken: business.resetToken,
            resetTokenExpiry: business.resetTokenExpiry,
            googleId: business.googleId,
        telegramId: business.telegramId,
        phone: business.phone,
        address: business.address,
        description: business.description,
        logo: business.logo,
        avatar: business.avatar,
        primaryColor: business.primaryColor || '#C5A059',
        secondaryColor: business.secondaryColor || '#FFFFFF',
        backgroundColor: business.backgroundColor || '#050505',
        surfaceColor: business.surfaceColor || '#121212',
        hideRevenue: business.hideRevenue || false,
        isActive: business.isActive !== undefined ? business.isActive : true,
        niche: business.niche || 'OTHER',
        customNiche: business.customNiche,
        businessIdentifier: business.businessIdentifier,
        profileCompleted: business.profileCompleted || false,
        settings: business.settings,
        businessCardBackgroundImage: business.businessCardBackgroundImage,
        slogan: business.slogan,
        additionalInfo: business.additionalInfo,
        socialMedia: business.socialMedia,
        workingHours: business.workingHours,
        location: business.location,
        telegramBotToken: business.telegramBotToken,
        telegramChatId: business.telegramChatId,
        telegramNotificationsEnabled: business.telegramNotificationsEnabled || false,
        telegramSettings: business.telegramSettings,
        aiChatEnabled: business.aiChatEnabled || false,
        aiProvider: business.aiProvider,
        aiApiKey: business.aiApiKey,
        aiSettings: business.aiSettings,
        smsProvider: business.smsProvider,
        smsApiKey: business.smsApiKey,
        smsSender: business.smsSender,
        emailProvider: business.emailProvider,
        emailApiKey: business.emailApiKey,
        emailFrom: business.emailFrom,
        emailFromName: business.emailFromName,
        paymentProvider: business.paymentProvider,
        paymentApiKey: business.paymentApiKey,
        paymentMerchantId: business.paymentMerchantId,
        paymentEnabled: business.paymentEnabled || false,
        remindersEnabled: business.remindersEnabled || false,
        reminderSmsEnabled: business.reminderSmsEnabled || false,
        reminderEmailEnabled: business.reminderEmailEnabled || false,
        registrationType: 'standard', // Буде оновлено при реєстрації
        registeredAt: business.createdAt || new Date(),
      },
    })

    return managementRecord
  } catch (error) {
    console.error('Error syncing business to Management Center:', error)
    return null
  }
}

/**
 * Реєструє бізнес в Центрі управління (ПОВНЕ ДУБЛЮВАННЯ ВСІХ ДАНИХ)
 */
/**
 * Реєструє бізнес в Центрі управління (ПОВНЕ ДУБЛЮВАННЯ ВСІХ ДАНИХ)
 * КРИТИЧНО ВАЖЛИВО: Всі акаунти мають бути в ManagementCenter
 */
export async function registerBusinessInManagementCenter(data: RegisterBusinessData) {
  try {
    // Використовуємо функцію синхронізації
    const managementRecord = await syncBusinessToManagementCenter(data.businessId)
    
    // Оновлюємо registrationType
    if (managementRecord) {
      await prisma.managementCenter.update({
        where: { businessId: data.businessId },
        data: {
          registrationType: data.registrationType,
        },
      })
    }
    
    // Додаємо номер телефону в PhoneDirectory (якщо є)
    if (data.business?.phone) {
      try {
        await prisma.phoneDirectory.upsert({
          where: {
            phone_category_businessId: {
              phone: data.business.phone,
              category: 'BUSINESS',
              businessId: data.businessId,
            },
          },
          update: {
            businessName: data.business.name,
            isActive: true,
            updatedAt: new Date(),
          },
          create: {
            phone: data.business.phone,
            category: 'BUSINESS',
            businessId: data.businessId,
            businessName: data.business.name,
            isActive: true,
            isVerified: false,
          },
        })
      } catch (error) {
        console.error('Error adding phone to directory:', error)
        // Не викидаємо помилку
      }
    }
    
    return managementRecord
  } catch (error) {
    console.error('КРИТИЧНА ПОМИЛКА: Error registering business in Management Center:', error)
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
 * Оновлює назву бізнесу в Реєстрі телефонів (усі записи категорії BUSINESS для цього бізнесу)
 */
export async function updateBusinessNameInDirectory(businessId: string, newName: string) {
  try {
    await prisma.phoneDirectory.updateMany({
      where: {
        businessId,
        category: 'BUSINESS',
      },
      data: {
        businessName: newName,
      },
    })
  } catch (error) {
    console.error('Error updating business name in directory:', error)
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

    // Оновлюємо в Центрі управління (синхронізуємо всі дані)
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    })

    // Використовуємо функцію синхронізації для оновлення всіх даних
    await syncBusinessToManagementCenter(businessId)
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

