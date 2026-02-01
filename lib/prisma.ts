import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Перевірка DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ Помилка: DATABASE_URL не знайдено в змінних оточення')
  console.error('📝 Створіть файл .env з наступним вмістом:')
  console.error('   DATABASE_URL="file:./prisma/dev.db" (для SQLite)')
  console.error('   або')
  console.error('   DATABASE_URL="postgresql://user:password@host:port/database" (для PostgreSQL)')
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  errorFormat: 'pretty',
})

// Тест підключення при ініціалізації (тільки в development)
if (process.env.NODE_ENV !== 'production' && !globalForPrisma.prisma) {
  prisma.$connect()
    .then(() => {
      console.log('✅ Підключення до бази даних успішне')
    })
    .catch((error) => {
      console.error('❌ Помилка підключення до бази даних:', error.message)
      console.error('💡 Перевірте налаштування DATABASE_URL в .env файлі')
    })
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma






