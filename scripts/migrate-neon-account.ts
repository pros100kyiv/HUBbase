/**
 * Міграція даних зі старого акаунту Neon на новий
 * Зберігає всі дані при зміні акаунту бази даних
 *
 * Використання:
 * 1. У .env має бути DATABASE_URL зі СТАРИМ підключенням
 * 2. NEW_DATABASE_URL передається як аргумент або змінна оточення
 * 3. Запуск: npx tsx scripts/migrate-neon-account.ts
 *    або: NEW_DATABASE_URL="postgresql://..." npx tsx scripts/migrate-neon-account.ts
 */

import 'dotenv/config'
import { Client } from 'pg'
import { execSync } from 'child_process'
import * as path from 'path'

const NEW_DATABASE_URL = process.env.NEW_DATABASE_URL

async function main() {
  const oldUrl = process.env.DATABASE_URL
  if (!oldUrl) {
    console.error('❌ DATABASE_URL не знайдено в .env (старий акаунт)')
    process.exit(1)
  }

  if (!NEW_DATABASE_URL) {
    console.error('❌ NEW_DATABASE_URL не вказано. Додайте в .env або: NEW_DATABASE_URL="..." npm run db:migrate-neon')
    process.exit(1)
  }

  if (oldUrl === NEW_DATABASE_URL) {
    console.error('❌ DATABASE_URL та NEW_DATABASE_URL однакові - вкажіть різні бази')
    process.exit(1)
  }

  console.log('🔄 Міграція Neon: старий акаунт → новий акаунт\n')
  console.log('📤 Джерело (старий):', oldUrl.replace(/:[^:@]+@/, ':****@'))
  console.log('📥 Призначення (новий):', NEW_DATABASE_URL.replace(/:[^:@]+@/, ':****@'))
  console.log('')

  const oldClient = new Client({ connectionString: oldUrl })
  const newClient = new Client({ connectionString: NEW_DATABASE_URL })

  try {
    await oldClient.connect()
    console.log('✅ Підключено до старої бази')

    await newClient.connect()
    console.log('✅ Підключено до нової бази\n')

    // 1. Створити схему в новій базі (db push — для порожньої бази)
    console.log('📋 Крок 1: Створення схеми в новій базі (prisma db push)...')
    const backupEnv = process.env.DATABASE_URL
    process.env.DATABASE_URL = NEW_DATABASE_URL
    try {
      execSync('npx prisma db push', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
      })
    } finally {
      process.env.DATABASE_URL = backupEnv
    }
    console.log('✅ Схему створено\n')

    // 2. Отримати список таблиць у правильному порядку (батьки перед дітьми)
    const tablesResult = await oldClient.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `)
    const allTables = tablesResult.rows.map((r) => r.tablename)

    // Таблиці в порядку залежностей (Prisma/PostgreSQL)
    const priorityOrder = [
      'Admin',
      'Business',
      'Master',
      'Service',
      'Client',
      'BusinessUser',
      'Appointment',
      'MasterUtilization',
      'AnalyticsReport',
      'DataImport',
      'DataExport',
      'TelegramUser',
      'TelegramVerification',
      'TelegramLog',
      'TelegramBroadcast',
      'TelegramReminder',
      'AIChatMessage',
      'Broadcast',
      'Payment',
      'ClientSegment',
      'SMSMessage',
      'SocialIntegration',
      'Note',
      'BusinessModule',
      'ManagementCenter',
      'PhoneDirectory',
      'GraphNode',
      'GraphRelationship',
      '_prisma_migrations',
    ]

    const orderedTables: string[] = []
    for (const t of priorityOrder) {
      if (allTables.includes(t)) orderedTables.push(t)
    }
    for (const t of allTables) {
      if (!orderedTables.includes(t)) orderedTables.push(t)
    }

    console.log('📋 Крок 2: Копіювання даних...\n')

    let totalRows = 0
    for (const table of orderedTables) {
      try {
        // _prisma_migrations вже є після migrate deploy — пропускаємо
        if (table === '_prisma_migrations') continue

        const colsResult = await oldClient.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1
           ORDER BY ordinal_position`,
          [table]
        )
        const columns = colsResult.rows.map((r) => r.column_name)
        if (columns.length === 0) continue

        const colsList = columns.map((c) => `"${c}"`).join(', ')
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')

        const selectResult = await oldClient.query(`SELECT * FROM "${table}"`)
        const rows = selectResult.rows

        if (rows.length > 0) {
          await newClient.query('BEGIN')
          try {
            for (const row of rows) {
              const values = columns.map((col) => row[col])
              await newClient.query(
                `INSERT INTO "${table}" (${colsList}) VALUES (${placeholders})`,
                values
              )
            }
            await newClient.query('COMMIT')
          } catch (err) {
            await newClient.query('ROLLBACK')
            throw err
          }
        }

        if (rows.length > 0) {
          totalRows += rows.length
          console.log(`   ✓ ${table}: ${rows.length} рядків`)
        }
      } catch (err) {
        console.error(`   ✗ ${table}:`, (err as Error).message)
      }
    }

    console.log('\n✅ Міграція даних завершена.\n')

    console.log(`\n✅ Міграцію завершено! Перенесено ${totalRows} рядків.\n`)
    console.log('📝 Наступні кроки:')
    console.log('   1. Оновіть .env: DATABASE_URL="' + NEW_DATABASE_URL.replace(/:[^:@]+@/, ':****@') + '"')
    console.log('   2. Якщо деплой на Vercel — оновіть DATABASE_URL в Environment Variables')
    console.log('   3. Запустіть: npm run db:sync-management (опціонально)\n')
  } finally {
    await oldClient.end()
    await newClient.end()
  }
}

main().catch((err) => {
  console.error('❌ Помилка:', err)
  process.exit(1)
})
