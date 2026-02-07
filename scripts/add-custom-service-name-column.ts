/**
 * One-off: add Appointment.customServiceName column if missing.
 * Run: npx tsx scripts/add-custom-service-name-column.ts
 */
import { prisma } from '../lib/prisma'

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "customServiceName" TEXT;
  `)
  console.log('Done: Appointment.customServiceName column ensured.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
