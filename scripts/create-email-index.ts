/**
 * Скрипт для створення унікального індексу на email (case-insensitive)
 * Це запобігає створенню дублікатів з різним регістром
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createEmailIndex() {
  try {
    console.log('🔧 Створення унікального індексу на email...\n')

    // Перевіряємо, чи індекс вже існує
    const existingIndex = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'Business' 
      AND indexname = 'Business_email_lower_idx'
    `)

    if (existingIndex.length > 0) {
      console.log('   ✅ Індекс вже існує')
      return
    }

    // Створюємо унікальний індекс на LOWER(email)
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX "Business_email_lower_idx" 
      ON "Business"(LOWER(TRIM(email)))
    `)

    console.log('   ✅ Унікальний індекс створено успішно')
    console.log('   📝 Тепер email будуть перевірятися незалежно від регістру\n')
  } catch (error: any) {
    if (error?.message?.includes('already exists')) {
      console.log('   ✅ Індекс вже існує')
    } else {
      console.error('   ❌ Помилка створення індексу:', error?.message || error)
      throw error
    }
  }
}

createEmailIndex()
  .then(() => {
    console.log('✅ Готово')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Помилка:', error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })

