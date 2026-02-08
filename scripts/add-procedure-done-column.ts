/**
 * Додає колонку procedureDone до Appointment, якщо її немає (PostgreSQL).
 * Запуск: npx tsx scripts/add-procedure-done-column.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "procedureDone" TEXT;
  `)
  console.log('✅ Колонку Appointment.procedureDone перевірено/додано')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
