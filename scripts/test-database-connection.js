// Скрипт для перевірки підключення до бази даних
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

async function testConnection() {
  console.log('🔍 Перевірка підключення до бази даних...\n')
  
  // Перевірка DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('❌ Помилка: DATABASE_URL не знайдено в змінних оточення')
    console.log('\n📝 Створіть файл .env з наступним вмістом:')
    console.log('\nДля локальної розробки (SQLite):')
    console.log('DATABASE_URL="file:./prisma/dev.db"')
    console.log('\nДля production (PostgreSQL):')
    console.log('DATABASE_URL="postgresql://user:password@host:port/database"')
    process.exit(1)
  }

  console.log('✅ DATABASE_URL знайдено')
  console.log(`   Тип: ${databaseUrl.startsWith('file:') ? 'SQLite' : databaseUrl.startsWith('postgresql:') ? 'PostgreSQL' : 'Невідомий'}`)
  
  // Приховуємо пароль у виводі
  const safeUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@')
  console.log(`   URL: ${safeUrl}\n`)

  // Спробуємо підключитися
  const prisma = new PrismaClient()
  
  try {
    console.log('🔄 Підключення до бази даних...')
    await prisma.$connect()
    console.log('✅ Підключення успішне!\n')
    
    // Перевірка таблиць
    console.log('🔍 Перевірка структури бази даних...')
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `.catch(() => {
      // Якщо це SQLite, інший спосіб
      return prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table'`
    })
    
    console.log(`✅ Знайдено таблиць: ${Array.isArray(tables) ? tables.length : 'невідомо'}`)
    
    // Перевірка таблиці Business
    try {
      const businessCount = await prisma.business.count()
      console.log(`✅ Таблиця Business існує (записів: ${businessCount})`)
    } catch (error) {
      console.log('⚠️  Таблиця Business не знайдена або не створена')
      console.log('   Виконайте: npx prisma db push')
    }
    
  } catch (error) {
    console.error('❌ Помилка підключення до бази даних:')
    console.error(`   ${error.message}\n`)
    
    if (error.message.includes('P1001')) {
      console.log('💡 Можливі причини:')
      console.log('   1. База даних не запущена')
      console.log('   2. Невірний DATABASE_URL')
      console.log('   3. Немає доступу до бази даних')
    } else if (error.message.includes('P1003')) {
      console.log('💡 Можливі причини:')
      console.log('   1. База даних не існує')
      console.log('   2. Створіть базу даних або виконайте: npx prisma db push')
    } else if (error.message.includes('does not exist')) {
      console.log('💡 Можливі причини:')
      console.log('   1. Таблиці не створені')
      console.log('   2. Виконайте: npx prisma db push')
    }
    
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
  
  console.log('\n✅ Всі перевірки пройдено успішно!')
}

testConnection().catch(console.error)

