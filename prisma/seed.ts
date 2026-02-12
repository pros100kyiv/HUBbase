import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create Business
  const hashedPassword = await bcrypt.hash('password123', 10)
  
  const business = await prisma.business.upsert({
    where: { id: 'business-1' },
    update: {},
    create: {
      id: 'business-1',
      name: '045 Barbershop',
      slug: '045-barbershop',
      email: 'admin@045barbershop.com',
      password: hashedPassword,
      description: 'Професійна стрижка та догляд за бородою',
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

  console.log('Seed data created:', { business, service1, service2, service3, master1, master2 })
  console.log('\nТестовий акаунт:')
  console.log('Email: admin@045barbershop.com')
  console.log('Password: password123')
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

