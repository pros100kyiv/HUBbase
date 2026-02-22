import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { addDays } from 'date-fns'

const prisma = new PrismaClient()

const TRIAL_DAYS = 14

async function main() {
  // Create Business (всі поля для роботи входу/реєстрації)
  const hashedPassword = await bcrypt.hash('password123', 10)
  const trialEndsAt = addDays(new Date(), TRIAL_DAYS)

  const business = await prisma.business.upsert({
    where: { id: 'business-1' },
    update: { aiChatEnabled: true },
    create: {
      id: 'business-1',
      name: '045 Barbershop',
      slug: '045-barbershop',
      email: 'admin@045barbershop.com',
      password: hashedPassword,
      description: 'Професійна стрижка та догляд за бородою',
      niche: 'OTHER',
      businessIdentifier: '045001',
      trialEndsAt,
      subscriptionStatus: 'trial',
      telegramNotificationsEnabled: true,
      aiChatEnabled: true,
    },
  })

  // Create Services
  const service1 = await prisma.service.upsert({
    where: { id: 'service-1' },
    update: {},
    create: {
      id: 'service-1',
      businessId: business.id,
      name: 'Чоловіча стрижка',
      price: 500,
      duration: 45,
      category: 'Стрижка',
    },
  })

  const service2 = await prisma.service.upsert({
    where: { id: 'service-2' },
    update: {},
    create: {
      id: 'service-2',
      businessId: business.id,
      name: 'Стрижка бороди',
      price: 300,
      duration: 30,
      category: 'Борода',
    },
  })

  const service3 = await prisma.service.upsert({
    where: { id: 'service-3' },
    update: {},
    create: {
      id: 'service-3',
      businessId: business.id,
      name: 'Комплекс',
      price: 700,
      duration: 75,
      category: 'Комплекс',
    },
  })

  const defaultWorkingHours = JSON.stringify({
    monday: { enabled: true, start: '09:00', end: '18:00' },
    tuesday: { enabled: true, start: '09:00', end: '18:00' },
    wednesday: { enabled: true, start: '09:00', end: '18:00' },
    thursday: { enabled: true, start: '09:00', end: '18:00' },
    friday: { enabled: true, start: '09:00', end: '18:00' },
    saturday: { enabled: false, start: '09:00', end: '18:00' },
    sunday: { enabled: false, start: '09:00', end: '18:00' },
  })

  // Create Masters
  const master1 = await prisma.master.upsert({
    where: { id: 'master-1' },
    update: { workingHours: defaultWorkingHours },
    create: {
      id: 'master-1',
      businessId: business.id,
      name: 'Олександр',
      bio: 'Досвідчений спеціаліст з 10-річним стажем',
      rating: 4.8,
      workingHours: defaultWorkingHours,
    },
  })

  const master2 = await prisma.master.upsert({
    where: { id: 'master-2' },
    update: { workingHours: defaultWorkingHours },
    create: {
      id: 'master-2',
      businessId: business.id,
      name: 'Дмитро',
      bio: 'Спеціаліст з класичних та сучасних стрижок',
      rating: 4.9,
      workingHours: defaultWorkingHours,
    },
  })

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SystemSetting" (
      "key" TEXT PRIMARY KEY,
      "value" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await prisma.systemSetting.upsert({
    where: { key: 'ai_provider' },
    update: { value: 'lm_studio' },
    create: { key: 'ai_provider', value: 'lm_studio' },
  })
  await prisma.systemSetting.upsert({
    where: { key: 'lm_studio_base_url' },
    update: { value: 'http://127.0.0.1:1234/v1' },
    create: { key: 'lm_studio_base_url', value: 'http://127.0.0.1:1234/v1' },
  })
  await prisma.systemSetting.upsert({
    where: { key: 'lm_studio_model' },
    update: { value: '' },
    create: { key: 'lm_studio_model', value: '' },
  })

  console.log('Seed data created:', { business, service1, service2, service3, master1, master2 })
  console.log('\nТестовий акаунт:')
  console.log('Email: admin@045barbershop.com')
  console.log('Password: password123')
  console.log('\nLM Studio: ai_provider=lm_studio, base_url=http://127.0.0.1:1234/v1')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

