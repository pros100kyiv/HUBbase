-- Add telegramChatId to Client for Telegram notifications
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT;

-- Add reminderTelegramEnabled to Business
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "reminderTelegramEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Add SMS, EMAIL, TELEGRAM to ReminderChannel enum
ALTER TYPE "ReminderChannel" ADD VALUE 'SMS';
ALTER TYPE "ReminderChannel" ADD VALUE 'EMAIL';
ALTER TYPE "ReminderChannel" ADD VALUE 'TELEGRAM';
