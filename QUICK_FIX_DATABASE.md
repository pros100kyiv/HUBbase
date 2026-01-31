# Швидке вирішення проблеми з DATABASE_URL

## 🔴 Проблема виявлена:

**Конфлікт:** Schema налаштована на `postgresql`, але `DATABASE_URL` вказує на SQLite.

## ✅ Швидке рішення (виберіть один варіант):

### Варіант 1: Локальна розробка з SQLite (тимчасово)

Якщо хочете швидко почати локально:

1. **Змініть `prisma/schema.prisma`:**
```prisma
datasource db {
  provider = "sqlite"  // змініть з "postgresql"
  url      = env("DATABASE_URL")
}
```

2. **В `.env` залиште:**
```env
DATABASE_URL="file:./dev.db"
```

3. **Виконайте:**
```bash
npx prisma generate
npx prisma db push
```

⚠️ **УВАГА:** Це працює тільки локально! Для Vercel потрібна PostgreSQL.

### Варіант 2: Налаштувати PostgreSQL (рекомендовано)

Для роботи і локально, і на Vercel:

#### A. Створіть PostgreSQL базу даних:

**Варіанти:**
- **Vercel Postgres** (найпростіше) - в Vercel Dashboard → Storage → Create Database
- **Neon** (безкоштовно) - https://neon.tech
- **Supabase** (безкоштовно) - https://supabase.com
- **Railway** - https://railway.app

#### B. Отримайте DATABASE_URL:

Формат: `postgresql://user:password@host:port/database?sslmode=require`

#### C. Оновіть `.env`:
```env
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
```

#### D. Виконайте міграцію:
```bash
npx prisma generate
npx prisma db push
```

#### E. Для Vercel:
Додайте той самий `DATABASE_URL` в Vercel Settings → Environment Variables

## 🔍 Перевірка:

Після налаштування виконайте:
```bash
npm run db:check
```

Або відкрийте в браузері:
- Локально: `http://localhost:3000/api/test-db`
- Vercel: `https://ваш-домен.vercel.app/api/test-db`

## 📝 Важливо:

- **Для Vercel обов'язково PostgreSQL!** SQLite не працює на Vercel.
- Після зміни `DATABASE_URL` завжди виконуйте `npx prisma generate && npx prisma db push`
- Не комітьте `.env` файл в git (він вже в `.gitignore`)

