import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function blockBusiness(businessIdentifier: string, isActive: boolean = false, reason?: string) {
  console.log(`🚀 ${isActive ? 'Розблоковування' : 'Блокування'} акаунту...\n`)

  // Знаходимо бізнес за businessIdentifier
  const business = await prisma.business.findUnique({
    where: { businessIdentifier },
    select: { 
      id: true, 
      name: true, 
      email: true, 
      businessIdentifier: true,
      isActive: true,
      settings: true,
    }
  })

  if (!business) {
    console.log(`❌ Бізнес з ID ${businessIdentifier} не знайдено`)
    return
  }

  if (business.isActive === isActive) {
    console.log(`ℹ️  Акаунт вже ${isActive ? 'розблоковано' : 'заблоковано'}`)
    console.log(`   Назва: ${business.name}`)
    console.log(`   Email: ${business.email}`)
    return
  }

  // Парсимо settings
  let settings = business.settings ? JSON.parse(business.settings) : {}
  
  if (!isActive && reason) {
    settings.blockReason = reason
    settings.blockedAt = new Date().toISOString()
    settings.blockedBy = 'admin-script'
  } else if (isActive) {
    delete settings.blockReason
    delete settings.blockedAt
    delete settings.blockedBy
    settings.unblockedAt = new Date().toISOString()
  }

  // Оновлюємо статус
  await prisma.business.update({
    where: { id: business.id },
    data: {
      isActive: isActive,
      settings: Object.keys(settings).length > 0 ? JSON.stringify(settings) : null,
    }
  })

  console.log(`✅ Акаунт "${business.name}" ${isActive ? 'розблоковано' : 'заблоковано'}`)
  console.log(`   Email: ${business.email}`)
  console.log(`   Business ID: ${business.businessIdentifier}`)
  if (reason && !isActive) {
    console.log(`   Причина: ${reason}`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log('Використання:')
    console.log('  npm run business:block <businessIdentifier> [reason]')
    console.log('  npm run business:unblock <businessIdentifier>')
    console.log('')
    console.log('Приклади:')
    console.log('  npm run business:block 56836 "Порушення правил"')
    console.log('  npm run business:unblock 56836')
    return
  }

  const businessIdentifier = args[0]
  const isUnblock = process.env.npm_lifecycle_event === 'business:unblock'
  const reason = isUnblock ? undefined : args[1]

  await blockBusiness(businessIdentifier, isUnblock, reason)
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

