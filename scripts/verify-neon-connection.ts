/**
 * Перевірка підключення до Neon (PostgreSQL).
 * Запуск: npx tsx scripts/verify-neon-connection.ts
 */

import { prisma } from '../lib/prisma'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('❌ DATABASE_URL не задано в .env')
    process.exit(1)
  }

  const isNeon = url.includes('neon.tech')
  const isPooler = url.includes('-pooler')
  if (isNeon) {
    console.log('🔗 Використовується Neon (pooler:', isPooler, ')\n')
  }

  try {
    await prisma.$queryRaw`SELECT 1 as ok`
    console.log('✅ Підключення до бази успішне.')

    const count = await prisma.business.count()
    console.log('   Бізнесів у базі:', count)

    if (isNeon && isPooler) {
      console.log('\n💡 Порада: для міграцій (prisma migrate) на Neon краще мати прямий URL.')
      console.log('   У Neon dashboard візьми "Direct connection" і додай в .env як DIRECT_URL.')
      console.log('   Потім у prisma/schema.prisma в datasource додай: directUrl = env("DIRECT_URL")')
    }
  } catch (e) {
    console.error('❌ Помилка підключення:', (e as Error).message)
    if (url.includes('neon.tech')) {
      console.log('\n   Перевір: 1) DATABASE_URL у .env 2) IP allow list у Neon 3) SSL (sslmode=require)')
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
