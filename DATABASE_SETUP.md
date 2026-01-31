# Налаштування DATABASE_URL

## Проблема

Проект налаштований для PostgreSQL, але локально може використовуватися SQLite. Потрібно правильно налаштувати `DATABASE_URL` для різних середовищ.

## Рішення

### Варіант 1: Локальна розробка з SQLite (швидкий старт)

Якщо ви хочете швидко почати роботу локально без налаштування PostgreSQL:

1. **Тимчасово змініть `prisma/schema.prisma`:**
```prisma
datasource db {
  provider = "sqlite"  // замість "postgresql"
  url      = env("DATABASE_URL")
}
```

2. **В `.env` файлі:**
```env
DATABASE_URL="file:./dev.db"
```

3. **Виконайте міграцію:**
```bash
npx prisma generate
npx prisma db push
```

### Варіант 2: Локальна розробка з PostgreSQL (рекомендовано)

Для тестування з тією ж базою, що і на Vercel:

1. **Створіть локальну PostgreSQL базу** (через Docker або встановлений PostgreSQL):
```bash
# Через Docker
docker run --name postgres-dev -e POSTGRES_PASSWORD=password -e POSTGRES_DB=barbershop -p 5432:5432 -d postgres
```

2. **В `.env` файлі:**
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/barbershop?sslmode=disable"
```

3. **Виконайте міграцію:**
```bash
npx prisma generate
npx prisma db push
```

### Варіант 3: Production на Vercel

1. **Створіть PostgreSQL базу даних:**
   - Vercel Postgres (рекомендовано)
   - Neon, Supabase, Railway, або інша

2. **Додайте `DATABASE_URL` в Vercel:**
   - Settings → Environment Variables
   - Формат: `postgresql://user:password@host:port/database?sslmode=require`

3. **Після деплою виконайте міграцію:**
```bash
vercel env pull .env.local
npx prisma db push
```

## Перевірка налаштування

### Локально:
Відкрийте в браузері: `http://localhost:3000/api/test-db`

### На Vercel:
Відкрийте: `https://ваш-домен.vercel.app/api/test-db`

Це покаже:
- Чи налаштована `DATABASE_URL`
- Чи підключена база даних
- Скільки бізнесів у базі

## Типові помилки

### "DATABASE_URL is not set"
- Перевірте, чи є `.env` файл локально
- Перевірте Environment Variables на Vercel

### "Can't reach database server"
- Перевірте правильність `DATABASE_URL`
- Перевірте, чи база даних активна
- Перевірте SSL налаштування (`?sslmode=require` для production)

### "Table does not exist"
- Виконайте міграцію: `npx prisma db push`

## Рекомендація

Для production обов'язково використовуйте PostgreSQL. SQLite працює тільки локально.

