-- Міграція для додавання полів візитівки до таблиці Business
-- Виконайте цей скрипт в вашій PostgreSQL базі даних

ALTER TABLE "Business" 
ADD COLUMN IF NOT EXISTS "businessCardBackgroundImage" TEXT,
ADD COLUMN IF NOT EXISTS "slogan" TEXT,
ADD COLUMN IF NOT EXISTS "additionalInfo" TEXT,
ADD COLUMN IF NOT EXISTS "socialMedia" TEXT,
ADD COLUMN IF NOT EXISTS "location" TEXT;

-- Перевірка, чи всі колонки додано
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Business' 
AND column_name IN (
  'businessCardBackgroundImage', 
  'slogan', 
  'additionalInfo', 
  'socialMedia', 
  'location'
);

