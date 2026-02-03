import { prisma } from '../lib/prisma'

/**
 * Скрипт для очищення бази даних від старих записів
 * Видаляє ВСІ записи, крім бізнесів, створених через Telegram OAuth
 * Надалі працюємо тільки з новоствореними бізнесами через Telegram OAuth
 */
async function cleanupDatabase() {
  try {
    console.log('🧹 Початок агресивного очищення бази даних...')
    console.log('⚠️  Видаляємо ВСІ записи, крім бізнесів з Telegram OAuth\n')
    
    // Отримуємо список бізнесів з Telegram OAuth, які залишаємо
    const telegramBusinesses = await prisma.business.findMany({
      where: {
        telegramId: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        telegramId: true,
        createdAt: true
      }
    })
    
    console.log(`📊 Знайдено бізнесів з Telegram OAuth: ${telegramBusinesses.length}`)
    if (telegramBusinesses.length > 0) {
      console.log('   Бізнеси, які залишаються:')
      telegramBusinesses.forEach((b, i) => {
        console.log(`   ${i + 1}. ${b.name} (ID: ${b.id}, Telegram ID: ${b.telegramId})`)
      })
    }
    console.log('')
    
    // Видаляємо ВСІ записи, крім тих, що належать бізнесам з Telegram OAuth
    const telegramBusinessIds = telegramBusinesses.map(b => b.id)
    
    // Якщо немає бізнесів з Telegram OAuth - видаляємо ВСЕ
    if (telegramBusinessIds.length === 0) {
      console.log('⚠️  Не знайдено бізнесів з Telegram OAuth. Видаляємо ВСЕ...\n')
    } else {
      console.log('✅ Залишаємо дані тільки для бізнесів з Telegram OAuth\n')
    }
    
    // Видаляємо записи в правильному порядку (з урахуванням foreign keys)
    
    // 1. Видаляємо SMS повідомлення (якщо немає Telegram бізнесів - видаляємо все)
    const deletedSMS = await prisma.sMSMessage.deleteMany({
      where: telegramBusinessIds.length > 0 ? {
        businessId: {
          notIn: telegramBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено SMS повідомлень: ${deletedSMS.count}`)
    
    // 2. Видаляємо AI чат повідомлення
    const deletedAIChat = await prisma.aIChatMessage.deleteMany({
      where: telegramBusinessIds.length > 0 ? {
        businessId: {
          notIn: telegramBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено AI чат повідомлень: ${deletedAIChat.count}`)
    
    // 3. Видаляємо платежі
    const deletedPayments = await prisma.payment.deleteMany({
      where: telegramBusinessIds.length > 0 ? {
        businessId: {
          notIn: telegramBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено платежів: ${deletedPayments.count}`)
    
    // 4. Видаляємо розсилки
    const deletedBroadcasts = await prisma.broadcast.deleteMany({
      where: telegramBusinessIds.length > 0 ? {
        businessId: {
          notIn: telegramBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено розсилок: ${deletedBroadcasts.count}`)
    
    // 5. Видаляємо записи (appointments)
    const deletedAppointments = await prisma.appointment.deleteMany({
      where: telegramBusinessIds.length > 0 ? {
        businessId: {
          notIn: telegramBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено записів: ${deletedAppointments.count}`)
    
    // 6. Видаляємо клієнтів
    const deletedClients = await prisma.client.deleteMany({
      where: telegramBusinessIds.length > 0 ? {
        businessId: {
          notIn: telegramBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено клієнтів: ${deletedClients.count}`)
    
    // 7. Видаляємо послуги
    const deletedServices = await prisma.service.deleteMany({
      where: telegramBusinessIds.length > 0 ? {
        businessId: {
          notIn: telegramBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено послуг: ${deletedServices.count}`)
    
    // 8. Видаляємо спеціалістів
    const deletedMasters = await prisma.master.deleteMany({
      where: telegramBusinessIds.length > 0 ? {
        businessId: {
          notIn: telegramBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено спеціалістів: ${deletedMasters.count}`)
    
    // 9. Видаляємо Telegram розсилки
    const deletedTelegramBroadcasts = await prisma.telegramBroadcast.deleteMany({
      where: telegramBusinessIds.length > 0 ? {
        businessId: {
          notIn: telegramBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено Telegram розсилок: ${deletedTelegramBroadcasts.count}`)
    
    // 10. Видаляємо Telegram нагадування
    const deletedTelegramReminders = await prisma.telegramReminder.deleteMany({
      where: telegramBusinessIds.length > 0 ? {
        businessId: {
          notIn: telegramBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено Telegram нагадувань: ${deletedTelegramReminders.count}`)
    
    // 11. Видаляємо Telegram користувачів
    const deletedTelegramUsers = await prisma.telegramUser.deleteMany({
      where: telegramBusinessIds.length > 0 ? {
        businessId: {
          notIn: telegramBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено Telegram користувачів: ${deletedTelegramUsers.count}`)
    
    // 12. Видаляємо інтеграції з соцмережами
    const deletedSocialIntegrations = await prisma.socialIntegration.deleteMany({
      where: telegramBusinessIds.length > 0 ? {
        businessId: {
          notIn: telegramBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено інтеграцій з соцмережами: ${deletedSocialIntegrations.count}`)
    
    // 13. Видаляємо сегменти клієнтів
    const deletedSegments = await prisma.clientSegment.deleteMany({
      where: telegramBusinessIds.length > 0 ? {
        businessId: {
          notIn: telegramBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено сегментів клієнтів: ${deletedSegments.count}`)
    
    // 14. Видаляємо аналітичні звіти
    const deletedAnalytics = await prisma.analyticsReport.deleteMany({
      where: telegramBusinessIds.length > 0 ? {
        businessId: {
          notIn: telegramBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено аналітичних звітів: ${deletedAnalytics.count}`)
    
    // 15. Видаляємо імпорти/експорти
    const deletedImports = await prisma.dataImport.deleteMany({
      where: telegramBusinessIds.length > 0 ? {
        businessId: {
          notIn: telegramBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено імпортів: ${deletedImports.count}`)
    
    const deletedExports = await prisma.dataExport.deleteMany({
      where: telegramBusinessIds.length > 0 ? {
        businessId: {
          notIn: telegramBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено експортів: ${deletedExports.count}`)
    
    // 16. Видаляємо Telegram логи
    const deletedTelegramLogs = await prisma.telegramLog.deleteMany({
      where: telegramBusinessIds.length > 0 ? {
        businessId: {
          notIn: telegramBusinessIds
        }
      } : {}
    })
    console.log(`✅ Видалено Telegram логів: ${deletedTelegramLogs.count}`)
    
    // 17. Видаляємо ВСІ бізнеси без Telegram ID
    // Залишаємо ТІЛЬКИ бізнеси з telegramId (створені через Telegram OAuth)
    const deletedBusinesses = await prisma.business.deleteMany({
      where: {
        telegramId: null // Видаляємо всі бізнеси без Telegram ID
      }
    })
    console.log(`✅ Видалено бізнесів (без Telegram ID): ${deletedBusinesses.count}`)
    
    // Показуємо скільки бізнесів залишилось
    const remainingBusinesses = await prisma.business.findMany({
      where: {
        telegramId: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        telegramId: true,
        createdAt: true
      }
    })
    console.log(`\n📊 Залишилось бізнесів (з Telegram OAuth): ${remainingBusinesses.length}`)
    if (remainingBusinesses.length > 0) {
      console.log('   Список бізнесів, які залишились:')
      remainingBusinesses.forEach((b, i) => {
        console.log(`   ${i + 1}. ${b.name} (ID: ${b.id}, створено: ${b.createdAt.toISOString()})`)
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

