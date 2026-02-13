import { prisma } from '../lib/prisma'

/**
 * Скрипт для очищення бази даних від старих записів
 * Залишає тільки бізнеси, створені через:
 * - Telegram OAuth (telegramId)
 * - Стандартну реєстрацію (password)
 * - Google OAuth (googleId)
 * Видаляє тільки старі тестові дані та бізнеси без жодного з цих полів
 */
async function cleanupDatabase() {
  try {
    console.log('🧹 Початок очищення бази даних...')
    console.log('✅ Залишаємо бізнеси через Telegram OAuth, стандартну реєстрацію та Google OAuth\n')
    
    // Отримуємо список бізнесів, які залишаємо (мають telegramId, googleId або password)
    const validBusinesses = await prisma.business.findMany({
      where: {
        OR: [
          { telegramId: { not: null } },      // Telegram OAuth
          { googleId: { not: null } },         // Google OAuth
          { password: { not: null } }         // Стандартна реєстрація
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        telegramId: true,
        googleId: true,
        password: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    const telegramCount = validBusinesses.filter(b => b.telegramId).length
    const googleCount = validBusinesses.filter(b => b.googleId).length
    const standardCount = validBusinesses.filter(b => b.password && !b.telegramId && !b.googleId).length
    
    console.log(`📊 Знайдено валідних бізнесів: ${validBusinesses.length}`)
    console.log(`   - Telegram OAuth: ${telegramCount}`)
    console.log(`   - Google OAuth: ${googleCount}`)
    console.log(`   - Стандартна реєстрація: ${standardCount}`)
    if (validBusinesses.length > 0) {
      console.log('\n   Бізнеси, які залишаються:')
      validBusinesses.forEach((b, i) => {
        const type = b.telegramId ? 'Telegram' : b.googleId ? 'Google' : 'Стандартна'
        console.log(`   ${i + 1}. ${b.name} (${b.email}) - ${type}`)
      })
    }
    console.log('')
    
    // Видаляємо записи, крім тих, що належать валідним бізнесам
    const validBusinessIds = validBusinesses.map(b => b.id)
    
    if (validBusinessIds.length === 0) {
      console.log('⚠️  Не знайдено валідних бізнесів. Видаляємо ВСЕ...\n')
    } else {
      console.log(`✅ Залишаємо дані для ${validBusinessIds.length} валідних бізнесів\n`)
    }
    
    // Видаляємо записи в правильному порядку (з урахуванням foreign keys)
    
    // 1. Видаляємо SMS повідомлення
    const deletedSMS = await prisma.sMSMessage.deleteMany({
      where: validBusinessIds.length > 0 ? {
        businessId: {
          notIn: validBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено SMS повідомлень: ${deletedSMS.count}`)
    
    // 2. Видаляємо AI чат повідомлення
    const deletedAIChat = await prisma.aIChatMessage.deleteMany({
      where: validBusinessIds.length > 0 ? {
        businessId: {
          notIn: validBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено AI чат повідомлень: ${deletedAIChat.count}`)
    
    // 3. Видаляємо платежі
    const deletedPayments = await prisma.payment.deleteMany({
      where: validBusinessIds.length > 0 ? {
        businessId: {
          notIn: validBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено платежів: ${deletedPayments.count}`)
    
    // 4. Видаляємо розсилки
    const deletedBroadcasts = await prisma.broadcast.deleteMany({
      where: validBusinessIds.length > 0 ? {
        businessId: {
          notIn: validBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено розсилок: ${deletedBroadcasts.count}`)
    
    // 5. Видаляємо записи (appointments)
    const deletedAppointments = await prisma.appointment.deleteMany({
      where: validBusinessIds.length > 0 ? {
        businessId: {
          notIn: validBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено записів: ${deletedAppointments.count}`)
    
    // 6. Видаляємо клієнтів
    const deletedClients = await prisma.client.deleteMany({
      where: validBusinessIds.length > 0 ? {
        businessId: {
          notIn: validBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено клієнтів: ${deletedClients.count}`)
    
    // 7. Видаляємо послуги
    const deletedServices = await prisma.service.deleteMany({
      where: validBusinessIds.length > 0 ? {
        businessId: {
          notIn: validBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено послуг: ${deletedServices.count}`)
    
    // 8. Видаляємо спеціалістів
    const deletedMasters = await prisma.master.deleteMany({
      where: validBusinessIds.length > 0 ? {
        businessId: {
          notIn: validBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено спеціалістів: ${deletedMasters.count}`)
    
    // 9. Видаляємо Telegram розсилки
    const deletedTelegramBroadcasts = await prisma.telegramBroadcast.deleteMany({
      where: validBusinessIds.length > 0 ? {
        businessId: {
          notIn: validBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено Telegram розсилок: ${deletedTelegramBroadcasts.count}`)
    
    // 10. Видаляємо Telegram нагадування
    const deletedTelegramReminders = await prisma.telegramReminder.deleteMany({
      where: validBusinessIds.length > 0 ? {
        businessId: {
          notIn: validBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено Telegram нагадувань: ${deletedTelegramReminders.count}`)
    
    // 11. Видаляємо Telegram користувачів
    const deletedTelegramUsers = await prisma.telegramUser.deleteMany({
      where: validBusinessIds.length > 0 ? {
        businessId: {
          notIn: validBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено Telegram користувачів: ${deletedTelegramUsers.count}`)
    
    // 12. Видаляємо інтеграції з соцмережами
    const deletedSocialIntegrations = await prisma.socialIntegration.deleteMany({
      where: validBusinessIds.length > 0 ? {
        businessId: {
          notIn: validBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено інтеграцій з соцмережами: ${deletedSocialIntegrations.count}`)
    
    // 13. Видаляємо сегменти клієнтів
    const deletedSegments = await prisma.clientSegment.deleteMany({
      where: validBusinessIds.length > 0 ? {
        businessId: {
          notIn: validBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено сегментів клієнтів: ${deletedSegments.count}`)
    
    // 14. Видаляємо аналітичні звіти
    const deletedAnalytics = await prisma.analyticsReport.deleteMany({
      where: validBusinessIds.length > 0 ? {
        businessId: {
          notIn: validBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено аналітичних звітів: ${deletedAnalytics.count}`)
    
    // 15. Видаляємо імпорти/експорти
    const deletedImports = await prisma.dataImport.deleteMany({
      where: validBusinessIds.length > 0 ? {
        businessId: {
          notIn: validBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено імпортів: ${deletedImports.count}`)
    
    const deletedExports = await prisma.dataExport.deleteMany({
      where: validBusinessIds.length > 0 ? {
        businessId: {
          notIn: validBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено експортів: ${deletedExports.count}`)
    
    // 16. Видаляємо Telegram логи
    const deletedTelegramLogs = await prisma.telegramLog.deleteMany({
      where: validBusinessIds.length > 0 ? {
        businessId: {
          notIn: validBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено Telegram логів: ${deletedTelegramLogs.count}`)
    
    // 17. Перед видаленням бізнесів знімаємо Telegram webhook, щоб той самий акаунт міг зареєструватися знову
    const toDeleteBusinesses = await prisma.business.findMany({
      where: {
        AND: [
          { telegramId: null },
          { googleId: null },
          { password: null }
        ]
      },
      select: { id: true, name: true, telegramBotToken: true }
    })
    for (const b of toDeleteBusinesses) {
      if (b.telegramBotToken) {
        try {
          await fetch(`https://api.telegram.org/bot${b.telegramBotToken}/deleteWebhook`, { method: 'POST' })
          console.log(`   📤 Webhook знято для бізнесу: ${b.name}`)
        } catch (e) {
          console.warn(`   ⚠️ Не вдалося зняти webhook для ${b.name}:`, e)
        }
      }
    }
    
    // 18. Видаляємо бізнеси без telegramId, googleId та password (старі тестові дані)
    const deletedBusinesses = await prisma.business.deleteMany({
      where: {
        AND: [
          { telegramId: null },
          { googleId: null },
          { password: null }
        ]
      }
    })
    console.log(`✅ Видалено бізнесів (старі тестові дані): ${deletedBusinesses.count}`)
    
    // Показуємо скільки бізнесів залишилось
    const remainingBusinesses = await prisma.business.findMany({
      where: {
        OR: [
          { telegramId: { not: null } },
          { googleId: { not: null } },
          { password: { not: null } }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        telegramId: true,
        googleId: true,
        password: true, // Додано для перевірки стандартної реєстрації
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    const remainingTelegram = remainingBusinesses.filter(b => b.telegramId).length
    const remainingGoogle = remainingBusinesses.filter(b => b.googleId).length
    const remainingStandard = remainingBusinesses.filter(b => b.password && !b.telegramId && !b.googleId).length
    
    console.log(`\n📊 Залишилось валідних бізнесів: ${remainingBusinesses.length}`)
    console.log(`   - Telegram OAuth: ${remainingTelegram}`)
    console.log(`   - Google OAuth: ${remainingGoogle}`)
    console.log(`   - Стандартна реєстрація: ${remainingStandard}`)
    if (remainingBusinesses.length > 0) {
      console.log('\n   Список бізнесів, які залишились:')
      remainingBusinesses.forEach((b, i) => {
        const type = b.telegramId ? 'Telegram OAuth' : b.googleId ? 'Google OAuth' : 'Стандартна реєстрація'
        console.log(`   ${i + 1}. ${b.name} (${b.email}) - ${type}`)
      })
    }
    
    console.log('\n✅ Очищення бази даних завершено!')
    console.log(`📊 Підсумок:`)
    console.log(`   - SMS: ${deletedSMS.count}`)
    console.log(`   - AI Chat: ${deletedAIChat.count}`)
    console.log(`   - Платежі: ${deletedPayments.count}`)
    console.log(`   - Розсилки: ${deletedBroadcasts.count}`)
    console.log(`   - Записи: ${deletedAppointments.count}`)
    console.log(`   - Клієнти: ${deletedClients.count}`)
    console.log(`   - Послуги: ${deletedServices.count}`)
    console.log(`   - Спеціалісти: ${deletedMasters.count}`)
    console.log(`   - Telegram розсилки: ${deletedTelegramBroadcasts.count}`)
    console.log(`   - Telegram нагадування: ${deletedTelegramReminders.count}`)
    console.log(`   - Telegram користувачі: ${deletedTelegramUsers.count}`)
    console.log(`   - Соцмережі: ${deletedSocialIntegrations.count}`)
    console.log(`   - Сегменти: ${deletedSegments.count}`)
    console.log(`   - Аналітика: ${deletedAnalytics.count}`)
    console.log(`   - Імпорти: ${deletedImports.count}`)
    console.log(`   - Експорти: ${deletedExports.count}`)
    console.log(`   - Telegram логи: ${deletedTelegramLogs.count}`)
    console.log(`   - Бізнеси: ${deletedBusinesses.count}`)
    
  } catch (error) {
    console.error('❌ Помилка при очищенні бази даних:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

cleanupDatabase()

