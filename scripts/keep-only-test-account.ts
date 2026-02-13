/**
 * Видаляє всі акаунти (бізнеси) і залишає тільки один тестовий.
 * Тестовий акаунт: test@example.com / test123
 *
 * Запуск: npx tsx scripts/keep-only-test-account.ts
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
  console.log('🧹 Видалення всіх акаунтів, залишаємо тільки тестовий...\n')

  // 1. Видаляємо записи з таблиць, які не мають Prisma cascade до Business
  try {
    const mc = await prisma.managementCenter.deleteMany({})
    console.log(`✅ Видалено ManagementCenter: ${mc.count}`)
  } catch (e: any) {
    if (e?.code === 'P2025' || e?.message?.includes('does not exist')) {
      console.log('⏭️ ManagementCenter: таблиця відсутня або порожня')
    } else throw e
  }

  try {
    const pd = await prisma.phoneDirectory.deleteMany({})
    console.log(`✅ Видалено PhoneDirectory: ${pd.count}`)
  } catch (e: any) {
    if (e?.code === 'P2025' || e?.message?.includes('does not exist')) {
      console.log('⏭️ PhoneDirectory: таблиця відсутня або порожня')
    } else throw e
  }

  try {
    const gr = await prisma.graphRelationship.deleteMany({})
    const gn = await prisma.graphNode.deleteMany({})
    console.log(`✅ Видалено GraphNode: ${gn.count}, GraphRelationship: ${gr.count}`)
  } catch (e: any) {
    if (e?.code === 'P2025' || e?.message?.includes('does not exist')) {
      console.log('⏭️ GraphNode/GraphRelationship: таблиці відсутні або порожні')
    } else throw e
  }

  // 2. Видаляємо всі бізнеси (cascade видалить Master, Service, Client, Appointment тощо)
  const deleted = await prisma.business.deleteMany({})
  console.log(`✅ Видалено бізнесів: ${deleted.count}\n`)

  // 3. Створюємо один тестовий акаунт
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

  // 4. Синхронізуємо з ManagementCenter
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

  console.log('\n✅ Готово! Тестовий акаунт:')
  console.log(`   Email: ${TEST_EMAIL}`)
  console.log(`   Пароль: ${TEST_PASSWORD}`)
}

main()
  .catch((e) => {
    console.error('❌ Помилка:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
