/**
 * Відновлення тестового акаунту: якщо в базі немає жодного бізнесу — створює один.
 * Нічого не видаляє. Після видалення акаунтів запустіть цей скрипт, щоб знову мати вхід/реєстрацію.
 *
 * Тестовий акаунт: test@example.com / test123
 *
 * Запуск: npx tsx scripts/restore-test-account.ts
 */

import { prisma } from '../lib/prisma'
import { hashPassword } from '../lib/auth'
import { getTrialEndDate } from '../lib/subscription'
import { generateBusinessIdentifier } from '../lib/utils/business-identifier'

const TEST_EMAIL = 'test@example.com'
const TEST_PASSWORD = 'test123'
const TEST_NAME = 'Тестовий бізнес'
const TEST_SLUG = 'test-business'

async function main() {
  console.log('🔍 Перевірка бази даних...\n')

  const count = await prisma.business.count()

  if (count > 0) {
    console.log(`✅ У базі вже є ${count} бізнес(ів). Нічого не створюємо.`)
    console.log('   Для входу використовуйте існуючі акаунти або реєстрацію.')
    return
  }

  console.log('📭 Бізнесів не знайдено. Створюємо тестовий акаунт...\n')

  const hashedPassword = await hashPassword(TEST_PASSWORD)
  const businessIdentifier = await generateBusinessIdentifier()
  const defaultTelegramBotToken =
    process.env.DEFAULT_TELEGRAM_BOT_TOKEN || '8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo'

  const business = await prisma.business.create({
    data: {
      name: TEST_NAME,
      email: TEST_EMAIL,
      password: hashedPassword,
      slug: TEST_SLUG,
      niche: 'OTHER',
      customNiche: null,
      businessIdentifier,
      telegramBotToken: defaultTelegramBotToken,
      telegramNotificationsEnabled: true,
      trialEndsAt: getTrialEndDate(),
      subscriptionStatus: 'trial',
    },
  })

  try {
    const { registerBusinessInManagementCenter } = await import('../lib/services/management-center')
    await registerBusinessInManagementCenter({
      businessId: business.id,
      business: business as any,
      registrationType: 'standard',
    })
    console.log('✅ Тестовий бізнес синхронізовано з ManagementCenter')
  } catch (e) {
    console.warn('⚠️ Не вдалося синхронізувати з ManagementCenter:', (e as Error).message)
  }

  console.log('\n✅ Готово! Відновлено тестовий акаунт:')
  console.log(`   Email: ${TEST_EMAIL}`)
  console.log(`   Пароль: ${TEST_PASSWORD}`)
  console.log('\n   Можете увійти в систему або реєструвати нові акаунти.')
}

main()
  .catch((e) => {
    console.error('❌ Помилка:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
