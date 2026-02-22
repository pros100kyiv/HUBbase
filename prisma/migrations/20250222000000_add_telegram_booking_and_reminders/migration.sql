-- Add telegramChatId to Client for Telegram notifications
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT;

-- Add reminderTelegramEnabled to Business
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "reminderTelegramEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Add SMS, EMAIL, TELEGRAM to ReminderChannel enum (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ReminderChannel' AND e.enumlabel = 'SMS') THEN
    ALTER TYPE "ReminderChannel" ADD VALUE 'SMS';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ReminderChannel' AND e.enumlabel = 'EMAIL') THEN
    ALTER TYPE "ReminderChannel" ADD VALUE 'EMAIL';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ReminderChannel' AND e.enumlabel = 'TELEGRAM') THEN
    ALTER TYPE "ReminderChannel" ADD VALUE 'TELEGRAM';
  END IF;
END $$;
