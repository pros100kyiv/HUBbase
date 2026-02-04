import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Українські імена та прізвища
const firstNames = [
  'Олександр', 'Дмитро', 'Андрій', 'Максим', 'Володимир', 'Іван', 'Сергій', 'Олег',
  'Марія', 'Олена', 'Анна', 'Наталія', 'Катерина', 'Юлія', 'Тетяна', 'Оксана'
]

const lastNames = [
  'Петренко', 'Коваленко', 'Шевченко', 'Бондаренко', 'Мельник', 'Ткаченко', 'Мороз',
  'Кравченко', 'Іваненко', 'Савченко', 'Бойко', 'Ткачук', 'Романенко', 'Лисенко'
]

const servicesNames = [
  'Чоловіча стрижка', 'Стрижка бороди', 'Комплекс', 'Дитяча стрижка',
  'Укладка', 'Фарбування', 'Манікюр', 'Педикюр', 'Масаж', 'Обличчя'
]

const statuses = ['Pending', 'Confirmed', 'Done', 'Cancelled']
const statusesUk = ['Очікує', 'Підтверджено', 'Виконано', 'Скасовано']

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

function getRandomPhone(): string {
  const prefix = ['050', '063', '066', '067', '068', '073', '091', '092', '093', '094', '095', '096', '097', '098', '099']
  const number = Math.floor(1000000 + Math.random() * 9000000)
  return `+380${getRandomElement(prefix).slice(1)}${number}`
}

function getRandomEmail(name: string): string {
  const domains = ['gmail.com', 'ukr.net', 'mail.ua', 'i.ua', 'yahoo.com']
  const cleanName = name.toLowerCase().replace(/\s/g, '')
  return `${cleanName}${Math.floor(Math.random() * 1000)}@${getRandomElement(domains)}`
}

function getRandomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

async function main() {
  console.log('🚀 Початок генерації тестових даних...\n')

  // Знаходимо перший бізнес або створюємо тестовий
  let business = await prisma.business.findFirst()
  
  if (!business) {
    console.log('❌ Бізнес не знайдено. Спочатку створіть бізнес через реєстрацію або seed.')
    return
  }

  console.log(`✅ Використовуємо бізнес: ${business.name} (${business.id})\n`)

  // Отримуємо майстрів та послуги
  const masters = await prisma.master.findMany({
    where: { businessId: business.id },
  })

  const services = await prisma.service.findMany({
    where: { businessId: business.id },
  })

  if (masters.length === 0) {
    console.log('❌ Майстри не знайдені. Створюємо тестових майстрів...')
    for (let i = 0; i < 3; i++) {
      await prisma.master.create({
        data: {
          businessId: business.id,
          name: getRandomElement(firstNames),
          bio: `Досвідчений майстер з ${5 + i * 2}-річним стажем`,
          rating: 4.5 + Math.random() * 0.5,
        },
      })
    }
    const newMasters = await prisma.master.findMany({
      where: { businessId: business.id },
    })
    masters.push(...newMasters)
  }

  if (services.length === 0) {
    console.log('❌ Послуги не знайдені. Створюємо тестові послуги...')
    for (let i = 0; i < 5; i++) {
      await prisma.service.create({
        data: {
          businessId: business.id,
          name: servicesNames[i] || `Послуга ${i + 1}`,
          price: (300 + Math.random() * 500) * 100, // в копійках
          duration: 30 + i * 15,
          category: 'Основні',
        },
      })
    }
    const newServices = await prisma.service.findMany({
      where: { businessId: business.id },
    })
    services.push(...newServices)
  }

  console.log(`✅ Майстрів: ${masters.length}, Послуг: ${services.length}\n`)

  // Створюємо клієнтів
  console.log('📝 Створюємо клієнтів...')
  const clients = []
  for (let i = 0; i < 15; i++) {
    const firstName = getRandomElement(firstNames)
    const lastName = getRandomElement(lastNames)
    const name = `${firstName} ${lastName}`
    const phone = getRandomPhone()
    const email = getRandomEmail(name)

    try {
      const client = await prisma.client.upsert({
        where: {
          businessId_phone: {
            businessId: business.id,
            phone,
          },
        },
        update: {},
        create: {
          businessId: business.id,
          name,
          phone,
          email,
          notes: i % 3 === 0 ? `Примітка для клієнта ${name}` : null,
          tags: i % 2 === 0 ? JSON.stringify(['VIP', 'Постійний']) : null,
        },
      })
      clients.push(client)
    } catch (error) {
      console.log(`⚠️  Помилка створення клієнта ${name}: ${error}`)
    }
  }
  console.log(`✅ Створено ${clients.length} клієнтів\n`)

  // Створюємо записи (appointments)
  console.log('📅 Створюємо записи...')
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 7) // 7 днів назад
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + 14) // 14 днів вперед

  const appointments = []
  for (let i = 0; i < 15; i++) {
    const master = getRandomElement(masters)
    const client = getRandomElement(clients)
    const service = getRandomElement(services)
    
    // Генеруємо випадкову дату в межах діапазону
    const appointmentDate = getRandomDate(startDate, endDate)
    const hour = 9 + Math.floor(Math.random() * 9) // 9:00 - 18:00
    const minute = [0, 15, 30, 45][Math.floor(Math.random() * 4)]
    
    appointmentDate.setHours(hour, minute, 0, 0)
    
    const startTime = new Date(appointmentDate)
    const endTime = new Date(appointmentDate)
    endTime.setMinutes(endTime.getMinutes() + service.duration)

    const status = getRandomElement(statuses)
    const statusUk = statusesUk[statuses.indexOf(status)]

    try {
      const appointment = await prisma.appointment.create({
        data: {
          businessId: business.id,
          masterId: master.id,
          clientId: client.id,
          clientName: client.name,
          clientPhone: client.phone,
          clientEmail: client.email,
          startTime,
          endTime,
          status: statusUk, // Використовуємо українську версію
          services: JSON.stringify([service.id]),
          notes: i % 4 === 0 ? `Примітка до запису ${i + 1}` : null,
          isFromBooking: i % 3 === 0,
          source: i % 3 === 0 ? 'qr' : 'phone',
        },
      })
      appointments.push(appointment)
    } catch (error) {
      console.log(`⚠️  Помилка створення запису ${i + 1}: ${error}`)
    }
  }
  console.log(`✅ Створено ${appointments.length} записів\n`)

  // Створюємо нотатки
  console.log('📝 Створюємо нотатки...')
  const noteTexts = [
    'Зв\'язатися з клієнтом про наступний візит',
    'Перевірити наявність матеріалів',
    'Підготувати робоче місце',
    'Надіслати нагадування клієнту',
    'Оновити прайс-лист',
    'Замовити нові інструменти',
    'Провести консультацію',
    'Підготувати звіт за місяць',
    'Зв\'язатися з постачальником',
    'Оновити інформацію на сайті',
  ]

  const notes = []
  for (let i = 0; i < 12; i++) {
    const noteDate = getRandomDate(startDate, endDate)
    noteDate.setHours(0, 0, 0, 0)
    
    try {
      const note = await prisma.note.create({
        data: {
          businessId: business.id,
          text: getRandomElement(noteTexts),
          date: noteDate,
          completed: Math.random() > 0.6,
          order: i,
        },
      })
      notes.push(note)
    } catch (error) {
      console.log(`⚠️  Помилка створення нотатки ${i + 1}: ${error}`)
    }
  }
  console.log(`✅ Створено ${notes.length} нотаток\n`)

  // Підсумок
  console.log('📊 Підсумок створених даних:')
  console.log(`   - Клієнти: ${clients.length}`)
  console.log(`   - Записи: ${appointments.length}`)
  console.log(`   - Нотатки: ${notes.length}`)
  console.log(`   - Майстри: ${masters.length}`)
  console.log(`   - Послуги: ${services.length}`)
  console.log('\n✅ Тестові дані успішно створені!')
  console.log('\n💡 Для видалення тестових даних виконайте: npm run test-data:clean')
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

