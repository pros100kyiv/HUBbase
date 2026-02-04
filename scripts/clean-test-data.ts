import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🗑️  Початок видалення тестових даних...\n')

  const business = await prisma.business.findFirst()
  
  if (!business) {
    console.log('❌ Бізнес не знайдено.')
    return
  }

  console.log(`✅ Використовуємо бізнес: ${business.name}\n`)

  // Видаляємо всі записи
  const deletedAppointments = await prisma.appointment.deleteMany({
    where: { businessId: business.id },
  })
  console.log(`✅ Видалено записів: ${deletedAppointments.count}`)

  // Видаляємо всіх клієнтів
  const deletedClients = await prisma.client.deleteMany({
    where: { businessId: business.id },
  })
  console.log(`✅ Видалено клієнтів: ${deletedClients.count}`)

  // Видаляємо всі нотатки
  const deletedNotes = await prisma.note.deleteMany({
    where: { businessId: business.id },
  })
  console.log(`✅ Видалено нотаток: ${deletedNotes.count}`)

  console.log('\n✅ Тестові дані успішно видалені!')
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

