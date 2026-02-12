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

const masterNames = [
  'Олександр', 'Дмитро', 'Андрій', 'Максим', 'Володимир', 'Іван'
]

const masterBios = [
  'Досвідчений спеціаліст з 10-річним стажем.',
  'Професійний спеціаліст з 8-річним досвідом.',
  'Спеціаліст з 12-річним стажем.',
  'Молодий талановитий спеціаліст.',
  'Ветеран індустрії з 15-річним досвідом.',
  'Спеціаліст з 7 роками досвіду.'
]

// Робочі години для спеціалістів (Пн-Пт 09:00-18:00, Сб-Нд вихідні)
const DEFAULT_MASTER_WORKING_HOURS = JSON.stringify({
  monday: { enabled: true, start: '09:00', end: '18:00' },
  tuesday: { enabled: true, start: '09:00', end: '18:00' },
  wednesday: { enabled: true, start: '09:00', end: '18:00' },
  thursday: { enabled: true, start: '09:00', end: '18:00' },
  friday: { enabled: true, start: '09:00', end: '18:00' },
  saturday: { enabled: false, start: '09:00', end: '18:00' },
  sunday: { enabled: false, start: '09:00', end: '18:00' },
})

const servicesNames = [
  'Чоловіча стрижка', 'Стрижка бороди', 'Комплекс (стрижка + борода)', 
  'Дитяча стрижка', 'Укладка волосся', 'Фарбування', 
  'Манікюр', 'Педикюр', 'Масаж голови', 'Обличчя (брошура)',
  'Стрижка під насадку', 'Класична стрижка', 'Модна стрижка',
  'Стрижка + миття', 'Повний комплекс догляду'
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

function getDateForDay(startDate: Date, dayOffset: number): Date {
  const date = new Date(startDate)
  date.setDate(date.getDate() + dayOffset)
  return date
}

async function main() {
  console.log('🚀 Початок генерації тестових даних...\n')

  // Знаходимо бізнес - спочатку шукаємо за email, businessIdentifier або беремо перший
  const businessEmail = process.argv[2] // Можна передати email як аргумент
  const businessId = process.argv[3] // Або businessIdentifier
  
  let business = null
  
  if (businessEmail) {
    business = await prisma.business.findUnique({ 
      where: { email: businessEmail.toLowerCase().trim() } 
    })
    if (!business) {
      console.log(`⚠️  Бізнес з email ${businessEmail} не знайдено, шукаємо за businessIdentifier...`)
    }
  }
  
  if (!business && businessId) {
    business = await prisma.business.findUnique({ 
      where: { businessIdentifier: businessId } 
    })
  }
  
  if (!business) {
    // Шукаємо за email diachenko333@telegram.xbase.online якщо не вказано інше
    const defaultEmail = 'diachenko333@telegram.xbase.online'
    business = await prisma.business.findUnique({ 
      where: { email: defaultEmail } 
    })
  }
  
  if (!business) {
    // Якщо все ще не знайдено, беремо перший
    business = await prisma.business.findFirst()
  }
  
  if (!business) {
    console.log('❌ Бізнес не знайдено. Спочатку створіть бізнес через реєстрацію або seed.')
    return
  }

  console.log(`✅ Використовуємо бізнес: ${business.name}`)
  console.log(`   Email: ${business.email}`)
  console.log(`   ID: ${business.id}`)
  if (business.businessIdentifier) {
    console.log(`   Business ID: ${business.businessIdentifier}`)
  }
  console.log('')

  // Створюємо майстрів (5-6)
  console.log('👨‍💼 Створюємо майстрів...')
  const existingMasters = await prisma.master.findMany({
    where: { businessId: business.id },
  })

  const mastersToCreate = 6 - existingMasters.length
  if (mastersToCreate > 0) {
    for (let i = 0; i < mastersToCreate; i++) {
      const name = masterNames[i] || `Спеціаліст ${i + 1}`
      const bio = masterBios[i] || `Досвідчений спеціаліст з ${5 + i * 2}-річним стажем`
      
      try {
        await prisma.master.create({
          data: {
            businessId: business.id,
            name,
            bio,
            rating: 4.5 + Math.random() * 0.5,
            isActive: true,
            workingHours: DEFAULT_MASTER_WORKING_HOURS,
          },
        })
      } catch (error) {
        console.log(`⚠️  Помилка створення спеціаліста ${name}: ${error}`)
      }
    }
  }

  // Оновлюємо спеціалістів без робочих годин
  await prisma.master.updateMany({
    where: { businessId: business.id, workingHours: null },
    data: { workingHours: DEFAULT_MASTER_WORKING_HOURS },
  })

  const masters = await prisma.master.findMany({
    where: { businessId: business.id },
  })
  console.log(`✅ Майстрів: ${masters.length}\n`)

  // Створюємо послуги (10-12)
  console.log('💼 Створюємо послуги...')
  const existingServices = await prisma.service.findMany({
    where: { businessId: business.id },
  })

  const servicesToCreate = 12 - existingServices.length
  if (servicesToCreate > 0) {
    for (let i = 0; i < servicesToCreate; i++) {
      const serviceName = servicesNames[i] || `Послуга ${i + 1}`
      const basePrice = [300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500, 2000, 2500][i] || 500
      
      try {
        await prisma.service.create({
          data: {
            businessId: business.id,
            name: serviceName,
            price: basePrice * 100, // в копійках
            duration: [30, 45, 60, 75, 90, 120][i % 6] || 45,
            category: i < 5 ? 'Стрижка' : i < 8 ? 'Догляд' : 'Комплекс',
            isActive: true,
          },
        })
      } catch (error) {
        console.log(`⚠️  Помилка створення послуги ${serviceName}: ${error}`)
      }
    }
  }

  const services = await prisma.service.findMany({
    where: { businessId: business.id },
  })
  console.log(`✅ Послуг: ${services.length}\n`)

  // Створюємо клієнтів (20)
  console.log('📝 Створюємо клієнтів...')
  const clients = []
  for (let i = 0; i < 20; i++) {
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
          notes: i % 4 === 0 ? `Примітка для клієнта ${name}` : null,
          tags: i % 3 === 0 ? JSON.stringify(['VIP', 'Постійний']) : null,
          isActive: true,
        },
      })
      clients.push(client)
    } catch (error) {
      console.log(`⚠️  Помилка створення клієнта ${name}: ${error}`)
    }
  }
  console.log(`✅ Створено ${clients.length} клієнтів\n`)

  // Створюємо записи (appointments) - розкидаємо рівномірно по датах
  console.log('📅 Створюємо записи (розкидаємо по датах)...')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 14) // 14 днів назад
  
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + 21) // 21 день вперед

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const appointmentsPerDay = Math.ceil(25 / totalDays) // ~25 записів загалом

  const appointments = []
  let appointmentIndex = 0

  // Проходимо по кожному дню
  for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
    const appointmentDate = getDateForDay(startDate, dayOffset)
    const dayOfWeek = appointmentDate.getDay()
    
    // Пропускаємо неділю (0) або зменшуємо кількість записів
    if (dayOfWeek === 0) continue

    // Кількість записів на день (більше в робочі дні)
    const recordsForDay = dayOfWeek === 6 ? 1 : (dayOfWeek < 5 ? appointmentsPerDay + 1 : appointmentsPerDay)
    
    for (let i = 0; i < recordsForDay && appointmentIndex < 25; i++) {
      const master = getRandomElement(masters)
      const client = getRandomElement(clients)
      const service = getRandomElement(services)
      
      // Розподіляємо записи по часу (9:00 - 18:00)
      const hour = 9 + Math.floor(Math.random() * 9)
      const minute = [0, 15, 30, 45][Math.floor(Math.random() * 4)]
      
      const startTime = new Date(appointmentDate)
      startTime.setHours(hour, minute, 0, 0)
      
      const endTime = new Date(startTime)
      endTime.setMinutes(endTime.getMinutes() + service.duration)

      // Розподіляємо статуси залежно від дати
      let status: string
      if (appointmentDate < today) {
        // Минулі записи - більшість виконані
        status = Math.random() > 0.2 ? 'Виконано' : (Math.random() > 0.5 ? 'Скасовано' : 'Очікує')
      } else if (appointmentDate.getTime() === today.getTime()) {
        // Сьогоднішні записи - різні статуси
        status = getRandomElement(['Очікує', 'Підтверджено', 'Виконано'])
      } else {
        // Майбутні записи - більшість підтверджені або очікують
        status = Math.random() > 0.3 ? 'Підтверджено' : 'Очікує'
      }

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
            status,
            services: JSON.stringify([service.id]),
            notes: appointmentIndex % 5 === 0 ? `Примітка до запису ${appointmentIndex + 1}` : null,
            isFromBooking: appointmentIndex % 3 === 0,
            source: appointmentIndex % 3 === 0 ? 'qr' : (appointmentIndex % 2 === 0 ? 'phone' : 'walk_in'),
          },
        })
        appointments.push(appointment)
        appointmentIndex++
      } catch (error) {
        // Якщо конфлікт часу, пропускаємо
        if (error instanceof Error && error.message.includes('Unique constraint')) {
          continue
        }
        console.log(`⚠️  Помилка створення запису ${appointmentIndex + 1}: ${error}`)
      }
    }
  }
  console.log(`✅ Створено ${appointments.length} записів\n`)

  // Створюємо нотатки (20) - розкидаємо по датах
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
    'Провести навчання персоналу',
    'Перевірити обладнання',
    'Підготувати маркетингову кампанію',
    'Зустрітися з новим клієнтом',
    'Оновити соціальні мережі',
  ]

  const notes = []
  for (let i = 0; i < 20; i++) {
    const dayOffset = Math.floor(Math.random() * totalDays)
    const noteDate = getDateForDay(startDate, dayOffset)
    noteDate.setHours(0, 0, 0, 0)
    
    try {
      const note = await prisma.note.create({
        data: {
          businessId: business.id,
          text: getRandomElement(noteTexts),
          date: noteDate,
          completed: Math.random() > 0.5,
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
  console.log(`   - Спеціалісти: ${masters.length}`)
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
