import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Українські імена та прізвища
const firstNames = [
  'Олександр', 'Дмитро', 'Андрій', 'Максим', 'Володимир', 'Іван', 'Сергій', 'Олег',
  'Марія', 'Олена', 'Анна', 'Наталія', 'Катерина', 'Юлія', 'Тетяна', 'Оксана',
  'Віктор', 'Михайло', 'Роман', 'Василь', 'Петро', 'Богдан', 'Тарас', 'Юрій',
  'Ірина', 'Світлана', 'Людмила', 'Валентина', 'Галина', 'Лариса', 'Надія', 'Віра'
]

const lastNames = [
  'Петренко', 'Коваленко', 'Шевченко', 'Бондаренко', 'Мельник', 'Ткаченко', 'Мороз',
  'Кравченко', 'Іваненко', 'Савченко', 'Бойко', 'Ткачук', 'Романенко', 'Лисенко',
  'Гриценко', 'Олійник', 'Шевчук', 'Козлов', 'Мазур', 'Білоус', 'Коваль', 'Левченко',
  'Семененко', 'Павленко', 'Василенко', 'Тарасенко', 'Марченко', 'Кравчук', 'Пономаренко'
]

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

function getRandomPhone(): string {
  const prefix = ['050', '063', '066', '067', '068', '073', '091', '092', '093', '094', '095', '096', '097', '098', '099']
  const number = Math.floor(1000000 + Math.random() * 9000000)
  return `+380${getRandomElement(prefix).slice(1)}${number}`
}

function getRandomEmail(name: string, index: number): string {
  const domains = ['gmail.com', 'ukr.net', 'mail.ua', 'i.ua', 'yahoo.com']
  const cleanName = name.toLowerCase().replace(/\s/g, '').replace(/[а-яіїєґ]/g, (char) => {
    const map: { [key: string]: string } = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'є': 'ye',
      'ж': 'zh', 'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k',
      'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's',
      'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh',
      'щ': 'sch', 'ь': '', 'ю': 'yu', 'я': 'ya', 'ґ': 'g'
    }
    return map[char] || char
  })
  return `${cleanName}${index}@${getRandomElement(domains)}`
}

async function main() {
  console.log('🚀 Початок додавання тестових клієнтів...\n')

  const businessId = process.argv[2] || '56836'
  
  // Шукаємо бізнес за id або businessIdentifier
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
    console.log('💡 Використання: tsx scripts/add-test-clients.ts <businessId або businessIdentifier>')
    return
  }

  console.log(`✅ Знайдено бізнес: ${business.name}`)
  console.log(`   Email: ${business.email}`)
  console.log(`   ID: ${business.id}`)
  if (business.businessIdentifier) {
    console.log(`   Business ID: ${business.businessIdentifier}`)
  }
  console.log('')

  // Перевіряємо, скільки вже є тестових клієнтів
  const allClients = await prisma.client.findMany({
    where: { businessId: business.id }
  })
  const existingTestClients = allClients.filter(client => {
    if (!client.tags) return false
    try {
      const tags = JSON.parse(client.tags)
      return Array.isArray(tags) && tags.includes('TEST_CLIENT')
    } catch {
      return client.tags.includes('TEST_CLIENT')
    }
  })

  console.log(`📊 Знайдено ${existingTestClients.length} існуючих тестових клієнтів\n`)

  // Створюємо 50 нових тестових клієнтів
  console.log('👥 Створюємо 50 тестових клієнтів...')
  const clients = []
  const createdPhones = new Set<string>()

  for (let i = 0; i < 50; i++) {
    let phone: string
    let attempts = 0
    // Генеруємо унікальний телефон
    do {
      phone = getRandomPhone()
      attempts++
      if (attempts > 100) {
        console.log(`⚠️  Не вдалося згенерувати унікальний телефон після 100 спроб`)
        break
      }
    } while (createdPhones.has(phone))

    if (attempts > 100) break

    createdPhones.add(phone)
    const firstName = getRandomElement(firstNames)
    const lastName = getRandomElement(lastNames)
    const name = `${firstName} ${lastName}`
    const email = getRandomEmail(name, i + 1)

    try {
      const client = await prisma.client.create({
        data: {
          businessId: business.id,
          name,
          phone,
          email,
          notes: i % 5 === 0 ? `Тестовий клієнт #${i + 1}. Створено для тестування системи.` : null,
          tags: JSON.stringify(['TEST_CLIENT']), // Маркер для легкого видалення
          metadata: JSON.stringify({ 
            testMarker: 'TEST_CLIENT',
            createdFor: 'testing',
            createdAt: new Date().toISOString()
          }),
          isActive: true,
        },
      })
      clients.push(client)
      if ((i + 1) % 10 === 0) {
        console.log(`   ✅ Створено ${i + 1}/50 клієнтів...`)
      }
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Конфлікт унікальності (телефон вже існує)
        console.log(`⚠️  Клієнт з телефоном ${phone} вже існує, пропускаємо...`)
        continue
      }
      console.log(`⚠️  Помилка створення клієнта ${name}: ${error.message}`)
    }
  }

  console.log(`\n✅ Успішно створено ${clients.length} тестових клієнтів`)
  console.log(`\n💡 Для видалення тестових клієнтів виконайте:`)
  console.log(`   tsx scripts/remove-test-clients.ts ${business.id}`)
  console.log(`\n📊 Статистика:`)
  console.log(`   - Всього тестових клієнтів: ${existingTestClients.length + clients.length}`)
  console.log(`   - Створено зараз: ${clients.length}`)
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

