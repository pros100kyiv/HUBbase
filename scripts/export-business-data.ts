/**
 * Скрипт для експорту даних бізнесу
 * Використання: npx tsx scripts/export-business-data.ts [businessId або slug]
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface BusinessData {
  business: any
  masters: any[]
  services: any[]
  appointments: any[]
  stats: {
    totalMasters: number
    totalServices: number
    totalAppointments: number
    totalClients: number
  }
}

async function exportBusinessData(identifier: string) {
  try {
    // Знайти бізнес по ID або slug
    const business = await prisma.business.findFirst({
      where: {
        OR: [
          { id: identifier },
          { slug: identifier }
        ]
      },
      include: {
        masters: {
          orderBy: { createdAt: 'desc' }
        },
        services: {
          orderBy: { createdAt: 'desc' }
        },
        appointments: {
          orderBy: { startTime: 'desc' },
          take: 1000 // Останні 1000 записів
        }
      }
    })

    if (!business) {
      console.error(`❌ Бізнес з ID/slug "${identifier}" не знайдено`)
      process.exit(1)
    }

    // Підрахунок унікальних клієнтів
    const uniqueClients = new Set(
      business.appointments.map(apt => apt.clientPhone)
    )

    const data: BusinessData = {
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        email: business.email,
        phone: business.phone,
        address: business.address,
        description: business.description,
        isActive: business.isActive,
        createdAt: business.createdAt,
        updatedAt: business.updatedAt
      },
      masters: business.masters.map(m => ({
        id: m.id,
        name: m.name,
        bio: m.bio,
        rating: m.rating,
        isActive: m.isActive,
        createdAt: m.createdAt
      })),
      services: business.services.map(s => ({
        id: s.id,
        name: s.name,
        price: s.price,
        duration: s.duration,
        category: s.category,
        isActive: s.isActive,
        createdAt: s.createdAt
      })),
      appointments: business.appointments.map(a => ({
        id: a.id,
        masterId: a.masterId,
        clientName: a.clientName,
        clientPhone: a.clientPhone,
        clientEmail: a.clientEmail,
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status,
        services: a.services,
        notes: a.notes,
        createdAt: a.createdAt
      })),
      stats: {
        totalMasters: business.masters.length,
        totalServices: business.services.length,
        totalAppointments: business.appointments.length,
        totalClients: uniqueClients.size
      }
    }

    // Створити папку якщо не існує
    const exportDir = path.join(process.cwd(), 'business-exports')
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true })
    }

    // Зберегти дані
    const filename = `business-${business.slug}-${Date.now()}.json`
    const filepath = path.join(exportDir, filename)
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8')

    console.log(`✅ Дані бізнесу "${business.name}" експортовано:`)
    console.log(`   📁 Файл: ${filepath}`)
    console.log(`   📊 Статистика:`)
    console.log(`      - Майстрів: ${data.stats.totalMasters}`)
    console.log(`      - Послуг: ${data.stats.totalServices}`)
    console.log(`      - Записів: ${data.stats.totalAppointments}`)
    console.log(`      - Унікальних клієнтів: ${data.stats.totalClients}`)

  } catch (error) {
    console.error('❌ Помилка при експорті:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Запуск
const identifier = process.argv[2]
if (!identifier) {
  console.error('❌ Вкажіть ID або slug бізнесу')
  console.log('   Приклад: npx tsx scripts/export-business-data.ts business-1')
  console.log('   Або: npx tsx scripts/export-business-data.ts 045-barbershop')
  process.exit(1)
}

exportBusinessData(identifier)

