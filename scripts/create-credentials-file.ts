/**
 * Скрипт для автоматичного створення файлу з логінами/паролями бізнесу
 * Використання: npx tsx scripts/create-credentials-file.ts [businessId або slug]
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function createCredentialsFile(identifier: string) {
  try {
    // Знайти бізнес
    const business = await prisma.business.findFirst({
      where: {
        OR: [
          { id: identifier },
          { slug: identifier }
        ]
      }
    })

    if (!business) {
      console.error(`❌ Бізнес з ID/slug "${identifier}" не знайдено`)
      process.exit(1)
    }

    // Створити папку якщо не існує
    const credentialsDir = path.join(process.cwd(), 'business-credentials')
    if (!fs.existsSync(credentialsDir)) {
      fs.mkdirSync(credentialsDir, { recursive: true })
    }

    // Створити файл
    const filename = `${business.slug}-credentials.md`
    const filepath = path.join(credentialsDir, filename)

    // Перевірити чи файл вже існує
    if (fs.existsSync(filepath)) {
      console.log(`⚠️  Файл ${filename} вже існує`)
      console.log(`   Використайте інший slug або видаліть існуючий файл`)
      process.exit(1)
    }

    // Створити контент файлу
    const content = `# ${business.name}

## Основна інформація
- **ID:** ${business.id}
- **Slug:** ${business.slug}
- **Email:** ${business.email}
- **Телефон:** ${business.phone || 'Не вказано'}
- **Назва:** ${business.name}

## Доступ
- **Логін:** ${business.email}
- **Пароль:** [ВКАЖІТЬ ПАРОЛЬ ВРУЧНУ - не зберігається в БД]
- **Google OAuth:** ${business.googleId ? 'Так' : 'Ні'}
- **Дата створення:** ${business.createdAt.toLocaleDateString('uk-UA')}

## Додаткова інформація
- **Адреса:** ${business.address || 'Не вказано'}
- **Опис:** ${business.description || 'Не вказано'}
- **Статус:** ${business.isActive ? '✅ Активний' : '❌ Неактивний'}

## Посилання
- **Dashboard:** https://yourdomain.com/dashboard
- **Booking:** https://yourdomain.com/booking/${business.slug}
- **QR Code:** https://yourdomain.com/qr/${business.slug}

## Примітки
- Файл створено автоматично скриптом
- Додайте пароль вручну (паролі не зберігаються в БД у відкритому вигляді)
- Оновлюйте файл при зміні даних бізнесу
`

    // Зберегти файл
    fs.writeFileSync(filepath, content, 'utf-8')

    console.log(`✅ Файл з логінами створено:`)
    console.log(`   📁 ${filepath}`)
    console.log(`\n⚠️  ВАЖЛИВО:`)
    console.log(`   - Додайте пароль вручну в файл`)
    console.log(`   - Файл НЕ комітиться в Git (додано в .gitignore)`)
    console.log(`   - Зберігайте файл в безпечному місці`)

  } catch (error) {
    console.error('❌ Помилка при створенні файлу:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Запуск
const identifier = process.argv[2]
if (!identifier) {
  console.error('❌ Вкажіть ID або slug бізнесу')
  console.log('   Приклад: npx tsx scripts/create-credentials-file.ts business-1')
  console.log('   Або: npx tsx scripts/create-credentials-file.ts 045-barbershop')
  process.exit(1)
}

createCredentialsFile(identifier)

