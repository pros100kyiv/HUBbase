import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🗑️  Початок видалення тестових клієнтів...\n')

  const businessId = process.argv[2]
  
  if (!businessId) {
    console.log('❌ Потрібно вказати ID бізнесу')
    console.log('💡 Використання: tsx scripts/remove-test-clients.ts <businessId>')
    return
  }

  // Шукаємо бізнес
  let business = null
  
  // Спочатку шукаємо за businessIdentifier
  business = await prisma.business.findUnique({ 
    where: { businessIdentifier: businessId } 
  })
  
  // Якщо не знайдено, шукаємо за id
  if (!business) {
    try {
      business = await prisma.business.findUnique({ 
        where: { id: businessId } 
      })
    } catch (error) {
      console.log(`⚠️  Помилка пошуку за ID: ${error}`)
    }
  }
  
  if (!business) {
    console.log(`❌ Бізнес з ID або businessIdentifier "${businessId}" не знайдено.`)
    return
  }

  console.log(`✅ Знайдено бізнес: ${business.name}`)
  console.log(`   ID: ${business.id}\n`)

  // Знаходимо всіх тестових клієнтів (за тегом TEST_CLIENT)
  const allClients = await prisma.client.findMany({
    where: { businessId: business.id }
  })
  const testClients = allClients.filter(client => {
    if (!client.tags) return false
    try {
      const tags = JSON.parse(client.tags)
      return Array.isArray(tags) && tags.includes('TEST_CLIENT')
    } catch {
      return client.tags.includes('TEST_CLIENT')
    }
  })

  console.log(`📊 Знайдено ${testClients.length} тестових клієнтів для видалення\n`)

  if (testClients.length === 0) {
    console.log('✅ Тестові клієнти не знайдені. Нічого видаляти.')
    return
  }

  // Підтвердження
  console.log('⚠️  УВАГА: Буде видалено всіх клієнтів з тегом TEST_CLIENT')
  console.log(`   Кількість: ${testClients.length} клієнтів\n`)

  // Видаляємо тестових клієнтів
  console.log('🗑️  Видаляємо тестових клієнтів...')
  
  let deletedCount = 0
  let errorCount = 0

  for (const client of testClients) {
    try {
      // Спочатку видаляємо всі пов'язані записи (appointments)
      await prisma.appointment.deleteMany({
        where: { clientId: client.id }
      })

      // Потім видаляємо клієнта
      await prisma.client.delete({
        where: { id: client.id }
      })
      deletedCount++
      
      if (deletedCount % 10 === 0) {
        console.log(`   ✅ Видалено ${deletedCount}/${testClients.length}...`)
      }
    } catch (error: any) {
      errorCount++
      console.log(`⚠️  Помилка видалення клієнта ${client.name} (${client.id}): ${error.message}`)
    }
  }

  console.log(`\n✅ Видалення завершено!`)
  console.log(`   - Успішно видалено: ${deletedCount}`)
  if (errorCount > 0) {
    console.log(`   - Помилок: ${errorCount}`)
  }
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

