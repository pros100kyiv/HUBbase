-- Add telegramChatId to Appointment for reliable Telegram notifications (fallback when Client.telegramChatId is missing)
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT;

-- Add businessNote for comments from business when confirming/rejecting
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "businessNote" TEXT;
