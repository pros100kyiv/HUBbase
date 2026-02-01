/**
 * Скрипт для виведення списку всіх бізнесів
 * Використання: npx tsx scripts/list-businesses.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function listBusinesses() {
  try {
    const businesses = await prisma.business.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            masters: true,
            services: true,
            appointments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (businesses.length === 0) {
      console.log('📭 Бізнесів не знайдено')
      return
    }

    console.log(`\n📋 Знайдено бізнесів: ${businesses.length}\n`)
    console.log('─'.repeat(100))

    businesses.forEach((business, index) => {
      console.log(`\n${index + 1}. ${business.name}`)
      console.log(`   ID: ${business.id}`)
      console.log(`   Slug: ${business.slug}`)
      console.log(`   Email: ${business.email}`)
      console.log(`   Телефон: ${business.phone || 'Не вказано'}`)
      console.log(`   Статус: ${business.isActive ? '✅ Активний' : '❌ Неактивний'}`)
      console.log(`   Створено: ${business.createdAt.toLocaleDateString('uk-UA')}`)
      console.log(`   Статистика:`)
      console.log(`      - Майстрів: ${business._count.masters}`)
      console.log(`      - Послуг: ${business._count.services}`)
      console.log(`      - Записів: ${business._count.appointments}`)
      console.log('─'.repeat(100))
    })

    console.log(`\n💡 Для експорту даних використовуйте:`)
    console.log(`   npx tsx scripts/export-business-data.ts [ID або slug]`)
    console.log(`\n   Приклад:`)
    console.log(`   npx tsx scripts/export-business-data.ts ${businesses[0].slug}`)

  } catch (error) {
    console.error('❌ Помилка:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

listBusinesses()

