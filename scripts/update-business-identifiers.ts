import { PrismaClient } from '@prisma/client'
import { generateBusinessIdentifier } from '../lib/utils/business-identifier'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Оновлення businessIdentifier для всіх акаунтів...\n')

  // Знаходимо всі бізнеси без businessIdentifier
  const businessesWithoutIdentifier = await prisma.business.findMany({
    where: {
      OR: [
        { businessIdentifier: null },
        { businessIdentifier: '' },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      businessIdentifier: true,
    },
  })

  console.log(`📊 Знайдено ${businessesWithoutIdentifier.length} акаунтів без businessIdentifier\n`)

  if (businessesWithoutIdentifier.length === 0) {
    console.log('✅ Всі акаунти вже мають businessIdentifier!')
    return
  }

  let updated = 0
  let errors = 0

  for (const business of businessesWithoutIdentifier) {
    try {
      const newIdentifier = await generateBusinessIdentifier()
      
      await prisma.business.update({
        where: { id: business.id },
        data: { businessIdentifier: newIdentifier },
      })

      console.log(`✅ ${business.name} (${business.email}) -> ${newIdentifier}`)
      updated++
    } catch (error) {
      console.error(`❌ Помилка для ${business.name} (${business.email}):`, error)
      errors++
    }
  }

  console.log(`\n📊 Підсумок:`)
  console.log(`   - Оновлено: ${updated}`)
  console.log(`   - Помилок: ${errors}`)
  console.log(`\n✅ Оновлення завершено!`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Помилка:', e)
    await prisma.$disconnect()
    process.exit(1)
  })

