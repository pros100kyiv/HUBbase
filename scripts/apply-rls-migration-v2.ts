/**
 * Скрипт для застосування RLS міграції до бази даних Neon
 * Виконує SQL міграцію для налаштування Row Level Security та тригерів
 * Версія 2: Правильна обробка PostgreSQL функцій з $$ блоками
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

// Розбиває SQL на окремі запити, правильно обробляючи $$ блоки
function parseSQLQueries(sql: string): string[] {
  const queries: string[] = []
  let currentQuery = ''
  let inDollarQuote = false
  let dollarTag = ''
  
  const lines = sql.split('\n')
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    // Пропускаємо коментарі та порожні рядки
    if (trimmed.startsWith('--') || trimmed.length === 0) {
      continue
    }
    
    // Перевіряємо початок $$ блоку
    if (trimmed.includes('$$')) {
      const dollarMatch = trimmed.match(/\$\$(\w*)\$?/)
      if (dollarMatch) {
        if (!inDollarQuote) {
          // Початок блоку
          inDollarQuote = true
          dollarTag = dollarMatch[1] || ''
          currentQuery += line + '\n'
        } else {
          // Перевіряємо, чи це кінець блоку
          if (trimmed.includes(`$$${dollarTag}`) || trimmed === '$$' || (dollarTag === '' && trimmed.includes('$$'))) {
            inDollarQuote = false
            currentQuery += line
            // Перевіряємо, чи є ; після блоку
            if (trimmed.endsWith(';')) {
              queries.push(currentQuery.trim())
              currentQuery = ''
            } else {
              // Шукаємо ; в наступних рядках
              let j = i + 1
              while (j < lines.length && !lines[j].trim().endsWith(';')) {
                currentQuery += lines[j] + '\n'
                j++
              }
              if (j < lines.length) {
                currentQuery += lines[j]
                queries.push(currentQuery.trim())
                currentQuery = ''
                i = j
              }
            }
          } else {
            currentQuery += line + '\n'
          }
        }
        continue
      }
    }
    
    // Якщо в $$ блоці - додаємо до поточного запиту
    if (inDollarQuote) {
      currentQuery += line + '\n'
      continue
    }
    
    // Звичайний SQL
    currentQuery += line + '\n'
    
    // Якщо рядок закінчується на ; і не в блоці - це кінець запиту
    if (trimmed.endsWith(';') && !inDollarQuote) {
      queries.push(currentQuery.trim())
      currentQuery = ''
    }
  }
  
  // Додаємо останній запит, якщо є
  if (currentQuery.trim().length > 0) {
    queries.push(currentQuery.trim())
  }
  
  // Фільтруємо порожні запити та коментарі
  return queries.filter(q => 
    q.length > 10 && 
    !q.startsWith('--') && 
    !q.startsWith('COMMENT') &&
    !q.startsWith('=') &&
    !q.match(/^--/)
  )
}

async function applyRLSMigration() {
  try {
    console.log('🔄 Початок застосування RLS міграції...\n')

    // Читаємо SQL файл (спочатку пробуємо fixed версію)
    let sqlPath = join(process.cwd(), 'prisma', 'migrations', 'multi_tenant_rls_setup-fixed.sql')
    try {
      readFileSync(sqlPath, 'utf-8')
    } catch {
      sqlPath = join(process.cwd(), 'prisma', 'migrations', 'multi_tenant_rls_setup.sql')
    }
    const sql = readFileSync(sqlPath, 'utf-8')

    console.log('📄 SQL міграція завантажена\n')

    // Парсимо SQL на окремі запити
    const queries = parseSQLQueries(sql)

    console.log(`📊 Знайдено SQL запитів: ${queries.length}\n`)

    let executed = 0
    let skipped = 0
    let errors = 0

    // Виконуємо кожен запит окремо
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i]
      
      // Пропускаємо порожні запити
      if (!query || query.length < 10) continue

      try {
        await prisma.$executeRawUnsafe(query)
        executed++
        
        // Показуємо прогрес для важливих операцій
        const operation = query.match(/(CREATE|ALTER|DROP|GRANT)\s+(EXTENSION|FUNCTION|POLICY|TRIGGER|TABLE|INDEX)/i)?.[0] || 
                         query.match(/(CREATE|ALTER|DROP|GRANT)/i)?.[0] || 'Query'
        if (operation !== 'Query') {
          console.log(`✅ ${operation}...`)
        }
      } catch (error: any) {
        // Ігноруємо помилки "вже існує"
        if (error?.message?.includes('already exists') || 
            error?.message?.includes('duplicate') ||
            error?.code === '42P07' ||
            error?.code === '42710') {
          skipped++
          // Не показуємо для пропущених
        } else {
          errors++
          console.error(`❌ Помилка виконання запиту ${i + 1}:`, error.message?.substring(0, 100))
          // Показуємо тільки перші 100 символів запиту
          const queryPreview = query.substring(0, 100).replace(/\n/g, ' ')
          console.error(`   Запит: ${queryPreview}...`)
        }
      }
    }

    console.log(`\n📊 Підсумок міграції:`)
    console.log(`   ✅ Успішно виконано: ${executed}`)
    console.log(`   ⏭️  Пропущено (вже існує): ${skipped}`)
    console.log(`   ❌ Помилок: ${errors}`)
    console.log(`   📝 Всього запитів: ${queries.length}`)

    // Перевіряємо, чи створені функції та тригери
    console.log('\n🔍 Перевірка створених об\'єктів...')

    try {
      const functions = await prisma.$queryRawUnsafe<Array<{ routine_name: string }>>(`
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name IN (
          'set_current_business_id',
          'get_current_business_id',
          'sync_to_admin_control_center',
          'sync_appointment_to_admin_control',
          'sync_business_to_admin_control'
        )
      `)
      console.log(`   ✅ Знайдено функцій: ${functions.length}/5`)
      if (functions.length < 5) {
        const found = functions.map(f => f.routine_name)
        const expected = ['set_current_business_id', 'get_current_business_id', 'sync_to_admin_control_center', 'sync_appointment_to_admin_control', 'sync_business_to_admin_control']
        const missing = expected.filter(e => !found.includes(e))
        console.log(`   ⚠️  Відсутні: ${missing.join(', ')}`)
      }
    } catch (error) {
      console.log(`   ⚠️  Не вдалося перевірити функції`)
    }

    try {
      const triggers = await prisma.$queryRawUnsafe<Array<{ trigger_name: string }>>(`
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE trigger_schema = 'public'
        AND trigger_name IN (
          'trigger_sync_client_to_admin_control',
          'trigger_sync_appointment_to_admin_control',
          'trigger_sync_business_to_admin_control'
        )
      `)
      console.log(`   ✅ Знайдено тригерів: ${triggers.length}/3`)
    } catch (error) {
      console.log(`   ⚠️  Не вдалося перевірити тригери`)
    }

    try {
      const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'admin_control_center'
      `)
      console.log(`   ✅ Таблиця admin_control_center: ${tables.length > 0 ? 'створена' : 'не знайдена'}`)
    } catch (error) {
      console.log(`   ⚠️  Не вдалося перевірити таблицю`)
    }

    console.log('\n✅ Міграція завершена!')
  } catch (error) {
    console.error('❌ Критична помилка міграції:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

applyRLSMigration()
  .then(() => {
    console.log('\n✅ RLS міграція успішно застосована!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Помилка застосування міграції:', error)
    process.exit(1)
  })

