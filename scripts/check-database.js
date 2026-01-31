#!/usr/bin/env node

/**
 * Скрипт для перевірки налаштування DATABASE_URL
 */

const fs = require('fs')
const path = require('path')

// Завантажуємо .env файл якщо він існує
const envPath = path.join(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^DATABASE_URL=(.+)$/)
      if (match) {
        const value = match[1].replace(/^["']|["']$/g, '')
        process.env.DATABASE_URL = value
      }
    }
  })
}

const databaseUrl = process.env.DATABASE_URL

console.log('🔍 Перевірка налаштування DATABASE_URL\n')

if (!databaseUrl) {
  console.error('❌ DATABASE_URL не налаштовано!')
  console.log('\n📝 Що робити:')
  console.log('1. Створіть .env файл в корені проекту')
  console.log('2. Додайте DATABASE_URL з одним з варіантів:\n')
  console.log('   Для SQLite (локальна розробка):')
  console.log('   DATABASE_URL="file:./dev.db"\n')
  console.log('   ⚠️  УВАГА: SQLite не працює на Vercel!')
  console.log('   Для Vercel потрібна PostgreSQL.\n')
  console.log('   Для PostgreSQL (локальна розробка):')
  console.log('   DATABASE_URL="postgresql://user:password@localhost:5432/database?sslmode=disable"\n')
  console.log('   Для PostgreSQL (Vercel/Production):')
  console.log('   DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"\n')
  process.exit(1)
}

console.log('✅ DATABASE_URL налаштовано')
const isSqlite = databaseUrl.startsWith('file:')
const isPostgres = databaseUrl.startsWith('postgresql:')

if (isSqlite) {
  console.log(`   Тип: SQLite`)
  console.log(`   Шлях: ${databaseUrl.replace('file:', '')}`)
} else if (isPostgres) {
  console.log(`   Тип: PostgreSQL`)
  // Приховуємо пароль в виводі
  const safeUrl = databaseUrl.replace(/:([^:@]+)@/, ':***@')
  console.log(`   URL: ${safeUrl}`)
} else {
  console.log(`   Тип: Невідомий`)
  console.log(`   Значення: ${databaseUrl.substring(0, 50)}...`)
}

// Перевіряємо чи відповідає schema.prisma
const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')

if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf-8')
  const providerMatch = schema.match(/provider\s*=\s*"(\w+)"/)
  
  if (providerMatch) {
    const provider = providerMatch[1]
    
    console.log(`\n📋 Prisma schema: provider = "${provider}"`)
    
    if (provider === 'sqlite' && isPostgres) {
      console.error('\n❌ КОНФЛІКТ: Schema налаштована на SQLite, але DATABASE_URL вказує на PostgreSQL!')
      console.log('   Змініть provider в prisma/schema.prisma на "postgresql"\n')
      process.exit(1)
    } else if (provider === 'postgresql' && isSqlite) {
      console.error('\n❌ КОНФЛІКТ: Schema налаштована на PostgreSQL, але DATABASE_URL вказує на SQLite!')
      console.log('\n   Варіанти вирішення:')
      console.log('   1. Для локальної розробки (тимчасово):')
      console.log('      - Змініть provider в prisma/schema.prisma на "sqlite"')
      console.log('      - Виконайте: npx prisma generate && npx prisma db push')
      console.log('\n   2. Для production на Vercel (рекомендовано):')
      console.log('      - Створіть PostgreSQL базу даних')
      console.log('      - Оновіть DATABASE_URL на PostgreSQL connection string')
      console.log('      - Виконайте: npx prisma db push\n')
      process.exit(1)
    } else {
      console.log('✅ Schema та DATABASE_URL відповідають\n')
    }
  }
}

if (isSqlite) {
  console.log('⚠️  УВАГА: Використовується SQLite')
  console.log('   SQLite працює тільки локально!')
  console.log('   Для Vercel обов\'язково потрібна PostgreSQL база даних.\n')
}

console.log('💡 Для тестування підключення:')
console.log('   1. Запустіть: npm run dev')
console.log('   2. Відкрийте: http://localhost:3000/api/test-db\n')
