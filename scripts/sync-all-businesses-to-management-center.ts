/**
 * Скрипт для синхронізації ВСІХ існуючих бізнесів в ManagementCenter
 * КРИТИЧНО ВАЖЛИВО: Всі акаунти мають бути в Центрі управління
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function syncAllBusinesses() {
  try {
    console.log('🔄 Початок синхронізації всіх бізнесів в ManagementCenter...\n')

    // Отримуємо всі бізнеси
    const businesses = await prisma.business.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })

    console.log(`📊 Знайдено бізнесів: ${businesses.length}\n`)

    let synced = 0
    let errors = 0

    for (const business of businesses) {
      try {
        // Визначаємо тип реєстрації
        let registrationType: 'telegram' | 'google' | 'standard' = 'standard'
        if (business.telegramId) {
          registrationType = 'telegram'
        } else if (business.googleId) {
          registrationType = 'google'
        }

        // Синхронізуємо в ManagementCenter
        const managementRecord = await prisma.managementCenter.upsert({
          where: { businessId: business.id },
          update: {
            // ПОВНЕ ДУБЛЮВАННЯ ВСІХ ДАНИХ
            name: business.name,
            slug: business.slug,
            email: business.email,
            password: business.password,
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
            registrationType: registrationType,
            registeredAt: business.createdAt || new Date(),
            updatedAt: new Date(),
          },
          create: {
            businessId: business.id,
            // ПОВНЕ ДУБЛЮВАННЯ ВСІХ ДАНИХ
            name: business.name,
            slug: business.slug,
            email: business.email,
            password: business.password,
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
            registrationType: registrationType,
            registeredAt: business.createdAt || new Date(),
          },
        })

        // Додаємо номер телефону в PhoneDirectory (якщо є)
        if (business.phone) {
          await prisma.phoneDirectory.upsert({
            where: {
              phone_category_businessId: {
                phone: business.phone,
                category: 'BUSINESS',
                businessId: business.id,
              },
            },
            update: {
              businessName: business.name,
              isActive: true,
              updatedAt: new Date(),
            },
            create: {
              phone: business.phone,
              category: 'BUSINESS',
              businessId: business.id,
              businessName: business.name,
              isActive: true,
              isVerified: false,
            },
          })
        }

        synced++
        console.log(`✅ Синхронізовано: ${business.name} (${business.email}) - ${registrationType}`)
      } catch (error) {
        errors++
        console.error(`❌ Помилка синхронізації ${business.name} (${business.id}):`, error)
      }
    }

    console.log(`\n📊 Підсумок синхронізації:`)
    console.log(`   ✅ Успішно синхронізовано: ${synced}`)
    console.log(`   ❌ Помилок: ${errors}`)
    console.log(`   📝 Всього бізнесів: ${businesses.length}`)

    // Перевіряємо, чи всі бізнеси в ManagementCenter
    const managementCount = await prisma.managementCenter.count()
    console.log(`\n📊 Записів в ManagementCenter: ${managementCount}`)

    if (managementCount === businesses.length) {
      console.log('✅ Всі бізнеси успішно синхронізовані в ManagementCenter!')
    } else {
      console.log(`⚠️  Увага: Кількість записів не співпадає (очікувалось ${businesses.length}, знайдено ${managementCount})`)
    }
  } catch (error) {
    console.error('❌ Критична помилка синхронізації:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

syncAllBusinesses()
  .then(() => {
    console.log('\n✅ Синхронізація завершена!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Помилка синхронізації:', error)
    process.exit(1)
  })

