/**
 * Скрипт для застосування RLS міграції до бази даних Neon
 * Виконує SQL міграцію, правильно обробляючи функції PostgreSQL
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

// Розбиває SQL на окремі команди, зберігаючи функції цілими
function splitSQLCommands(sql: string): string[] {
  const commands: string[] = []
  let currentCommand = ''
  let inFunction = false
  let dollarTag = ''
  let depth = 0
  
  const lines = sql.split('\n')
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    // Пропускаємо коментарі та порожні рядки
    if (trimmed.startsWith('--') || trimmed.length === 0) {
      continue
    }
    
    // Перевіряємо початок функції (CREATE FUNCTION)
    if (trimmed.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION/i) || trimmed.match(/CREATE\s+FUNCTION/i)) {
      inFunction = true
      depth = 0
      currentCommand = line + '\n'
      // Шукаємо dollar tag
      const dollarMatch = line.match(/\$(\w*)\$/i)
      if (dollarMatch) {
        dollarTag = dollarMatch[1] || ''
      }
      continue
    }
    
    // Якщо в функції - збираємо до кінця
    if (inFunction) {
      currentCommand += line + '\n'
      
      // Перевіряємо закриття функції
      if (trimmed.includes('$$') || trimmed.includes(`$$${dollarTag}`)) {
        // Можливо кінець функції
        if (trimmed.match(/\$\$\s*LANGUAGE/i) || trimmed.match(/\$\$\s*;\s*$/)) {
          inFunction = false
          if (trimmed.endsWith(';')) {
            commands.push(currentCommand.trim())
            currentCommand = ''
          }
        }
      } else if (trimmed.endsWith(';') && !inFunction) {
        commands.push(currentCommand.trim())
        currentCommand = ''
        inFunction = false
      }
      continue
    }
    
    // Звичайні команди
    currentCommand += line + '\n'
    
    // Якщо команда закінчується на ; - це кінець
    if (trimmed.endsWith(';')) {
      commands.push(currentCommand.trim())
      currentCommand = ''
    }
  }
  
  // Додаємо останню команду
  if (currentCommand.trim().length > 0) {
    commands.push(currentCommand.trim())
  }
  
  return commands.filter(c => c.length > 5 && !c.startsWith('--'))
}

async function applyRLSMigration() {
  try {
    console.log('🔄 Початок застосування RLS міграції...\n')

    // Читаємо SQL файл
    let sqlPath = join(process.cwd(), 'prisma', 'migrations', 'multi_tenant_rls_setup-fixed.sql')
    try {
      readFileSync(sqlPath, 'utf-8')
    } catch {
      sqlPath = join(process.cwd(), 'prisma', 'migrations', 'multi_tenant_rls_setup.sql')
    }
    const sql = readFileSync(sqlPath, 'utf-8')

    console.log('📄 SQL міграція завантажена\n')

    // Розбиваємо на команди
    const commands = splitSQLCommands(sql)
    console.log(`📊 Знайдено SQL команд: ${commands.length}\n`)

    let executed = 0
    let skipped = 0
    let errors = 0

    // Виконуємо кожну команду
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i]
      
      if (!command || command.length < 5) continue

      try {
        await prisma.$executeRawUnsafe(command)
        executed++
        
        // Показуємо прогрес для важливих операцій
        const match = command.match(/(CREATE|ALTER|DROP|GRANT)\s+(EXTENSION|FUNCTION|POLICY|TRIGGER|TABLE|INDEX)/i)
        if (match) {
          const operation = match[0]
          console.log(`✅ ${operation}...`)
        }
      } catch (error: any) {
        // Ігноруємо помилки "вже існує"
        if (error?.message?.includes('already exists') || 
            error?.message?.includes('duplicate') ||
            error?.code === '42P07' ||
            error?.code === '42710') {
          skipped++
        } else {
          errors++
          const errorMsg = error?.message?.substring(0, 80) || 'Unknown error'
          console.error(`❌ Помилка команди ${i + 1}: ${errorMsg}`)
          // Показуємо перші 60 символів команди
          const cmdPreview = command.substring(0, 60).replace(/\n/g, ' ')
          console.error(`   Команда: ${cmdPreview}...`)
        }
      }
    }

    console.log(`\n📊 Підсумок міграції:`)
    console.log(`   ✅ Успішно виконано: ${executed}`)
    console.log(`   ⏭️  Пропущено (вже існує): ${skipped}`)
    console.log(`   ❌ Помилок: ${errors}`)
    console.log(`   📝 Всього команд: ${commands.length}`)

    // Перевіряємо результати
    console.log('\n🔍 Перевірка створених об\'єктів...\n')

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
      console.log(`   ✅ Функцій: ${functions.length}/5`)
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
      console.log(`   ✅ Тригерів: ${triggers.length}/3`)
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
