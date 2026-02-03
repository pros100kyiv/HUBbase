import { prisma } from '../lib/prisma'

/**
 * Скрипт для очищення бази даних від старих записів
 * Залишає тільки записи, створені після підключення Telegram OAuth (годину тому)
 */
async function cleanupDatabase() {
  try {
    console.log('🧹 Початок очищення бази даних...')
    
    // Визначаємо час, коли було підключено Telegram OAuth (годину тому)
    const telegramOAuthTime = new Date()
    telegramOAuthTime.setHours(telegramOAuthTime.getHours() - 1)
    
    console.log(`📅 Залишаємо записи, створені після: ${telegramOAuthTime.toISOString()}`)
    
    // Видаляємо старі записи в правильному порядку (з урахуванням foreign keys)
    
    // 1. Видаляємо старі SMS повідомлення
    const deletedSMS = await prisma.sMSMessage.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        }
      }
    })
    console.log(`✅ Видалено SMS повідомлень: ${deletedSMS.count}`)
    
    // 2. Видаляємо старі AI чат повідомлення
    const deletedAIChat = await prisma.aIChatMessage.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        }
      }
    })
    console.log(`✅ Видалено AI чат повідомлень: ${deletedAIChat.count}`)
    
    // 3. Видаляємо старі платежі
    const deletedPayments = await prisma.payment.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        }
      }
    })
    console.log(`✅ Видалено платежів: ${deletedPayments.count}`)
    
    // 4. Видаляємо старі розсилки
    const deletedBroadcasts = await prisma.broadcast.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        }
      }
    })
    console.log(`✅ Видалено розсилок: ${deletedBroadcasts.count}`)
    
    // 5. Видаляємо старі записи (appointments)
    const deletedAppointments = await prisma.appointment.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        }
      }
    })
    console.log(`✅ Видалено записів: ${deletedAppointments.count}`)
    
    // 6. Видаляємо старі клієнтів
    const deletedClients = await prisma.client.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        }
      }
    })
    console.log(`✅ Видалено клієнтів: ${deletedClients.count}`)
    
    // 7. Видаляємо старі послуги
    const deletedServices = await prisma.service.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        }
      }
    })
    console.log(`✅ Видалено послуг: ${deletedServices.count}`)
    
    // 8. Видаляємо старих спеціалістів
    const deletedMasters = await prisma.master.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        }
      }
    })
    console.log(`✅ Видалено спеціалістів: ${deletedMasters.count}`)
    
    // 9. Видаляємо старі Telegram розсилки
    const deletedTelegramBroadcasts = await prisma.telegramBroadcast.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        }
      }
    })
    console.log(`✅ Видалено Telegram розсилок: ${deletedTelegramBroadcasts.count}`)
    
    // 10. Видаляємо старі Telegram нагадування
    const deletedTelegramReminders = await prisma.telegramReminder.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        }
      }
    })
    console.log(`✅ Видалено Telegram нагадувань: ${deletedTelegramReminders.count}`)
    
    // 11. Видаляємо старих Telegram користувачів (але не тих, що пов'язані з бізнесами, створеними після Telegram OAuth)
    const deletedTelegramUsers = await prisma.telegramUser.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        },
        business: {
          createdAt: {
            lt: telegramOAuthTime
          }
        }
      }
    })
    console.log(`✅ Видалено Telegram користувачів: ${deletedTelegramUsers.count}`)
    
    // 12. Видаляємо старі інтеграції з соцмережами
    const deletedSocialIntegrations = await prisma.socialIntegration.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        }
      }
    })
    console.log(`✅ Видалено інтеграцій з соцмережами: ${deletedSocialIntegrations.count}`)
    
    // 13. Видаляємо старі сегменти клієнтів
    const deletedSegments = await prisma.clientSegment.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        }
      }
    })
    console.log(`✅ Видалено сегментів клієнтів: ${deletedSegments.count}`)
    
    // 14. Видаляємо старі аналітичні звіти
    const deletedAnalytics = await prisma.analyticsReport.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        }
      }
    })
    console.log(`✅ Видалено аналітичних звітів: ${deletedAnalytics.count}`)
    
    // 15. Видаляємо старі імпорти/експорти
    const deletedImports = await prisma.dataImport.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        }
      }
    })
    console.log(`✅ Видалено імпортів: ${deletedImports.count}`)
    
    const deletedExports = await prisma.dataExport.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        }
      }
    })
    console.log(`✅ Видалено експортів: ${deletedExports.count}`)
    
    // 16. Видаляємо старі Telegram логи
    const deletedTelegramLogs = await prisma.telegramLog.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        }
      }
    })
    console.log(`✅ Видалено Telegram логів: ${deletedTelegramLogs.count}`)
    
    // 17. Видаляємо старі бізнеси (які не мають telegramId)
    const deletedBusinesses = await prisma.business.deleteMany({
      where: {
        createdAt: {
          lt: telegramOAuthTime
        },
        telegramId: null // Видаляємо тільки ті, що не мають Telegram ID
      }
    })
    console.log(`✅ Видалено бізнесів: ${deletedBusinesses.count}`)
    
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

