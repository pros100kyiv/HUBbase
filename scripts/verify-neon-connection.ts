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
  const hasConnectionLimit = /[?&]connection_limit=/.test(url)
  if (isNeon) {
    console.log('🔗 Використовується Neon (pooler:', isPooler, ', connection_limit:', hasConnectionLimit ? 'так' : 'немає', ')\n')
  }

  try {
    await prisma.$queryRaw`SELECT 1 as ok`
    console.log('✅ Підключення до бази успішне.')

    const count = await prisma.business.count()
    console.log('   Бізнесів у базі:', count)

    if (isNeon) {
      const tips: string[] = []
      if (!isPooler) tips.push('використай Pooled URL (з -pooler у хості)')
      if (!hasConnectionLimit && process.env.VERCEL) tips.push('на Vercel додаток сам додає connection_limit=1')
      if (!hasConnectionLimit && !process.env.VERCEL) tips.push('для serverless можна додати &connection_limit=1 до DATABASE_URL')
      if (!isPooler) {
        tips.push('для міграцій краще DIRECT_URL (без -pooler) + directUrl у schema.prisma')
      }
      if (tips.length) console.log('\n💡 Поради:', tips.join('; '))
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
