# Інструкції для міграції бази даних

## Проблема
База даних не містить нових полів, які були додані до схеми Prisma для візитівки бізнесу.

## Рішення

### Варіант 1: Використання Prisma (рекомендовано)

Якщо у вас є доступ до терміналу, виконайте:

```bash
npx prisma db push
```

Це автоматично застосує всі зміни зі схеми до бази даних.

### Варіант 2: SQL міграція вручну

Якщо ви не можете використати `prisma db push`, виконайте SQL-скрипт вручну:

1. Підключіться до вашої PostgreSQL бази даних
2. Виконайте SQL-скрипт з файлу `prisma/migrations/add_business_card_fields.sql`

### Варіант 3: Через Vercel (якщо проект на Vercel)

1. Перейдіть до налаштувань проекту на Vercel
2. Відкрийте вкладку "Storage" або "Database"
3. Підключіться до бази даних через Prisma Studio або виконайте SQL-скрипт

## Перевірка

Після виконання міграції перевірте, чи всі поля додано:

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'Business' 
AND column_name IN (
  'businessCardBackgroundImage', 
  'slogan', 
  'additionalInfo', 
  'socialMedia', 
  'location'
);
```

## Поля, які потрібно додати:

- `businessCardBackgroundImage` (TEXT, nullable) - URL до фонового зображення
- `slogan` (TEXT, nullable) - Слоган бізнесу
- `additionalInfo` (TEXT, nullable) - Додаткова інформація
- `socialMedia` (TEXT, nullable) - JSON з соціальними мережами
- `location` (TEXT, nullable) - Розташування/адреса

## Важливо

Після виконання міграції:
1. Перезапустіть сервер розробки
2. Спробуйте увійти/зареєструватися знову
3. Перевірте, чи працює збереження візитівки

