-- Run this on production DB if you get: "The column Appointment.customServiceName does not exist"
-- Or run: npm run db:migrate-deploy (with DATABASE_URL set)

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "customServiceName" TEXT;
