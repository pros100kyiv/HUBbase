# Troubleshooting - Вирішення проблем на Vercel

## Помилка 500 Internal Server Error при реєстрації

### Найчастіші причини:

### 1. База даних не налаштована ❌

**Симптоми:**
- Помилка 500 при реєстрації/вході
- В логах: "DATABASE_URL is not set" або "Can't reach database server"

**Рішення:**
1. Створіть PostgreSQL базу даних (Vercel Postgres, Neon, Supabase)
2. Додайте `DATABASE_URL` в Vercel Settings → Environment Variables
3. Формат: `postgresql://user:password@host:port/database?sslmode=require`
4. Перезберіть проект на Vercel

### 2. Prisma Client не згенерований ❌

**Симптоми:**
- Помилка: "Prisma Client not generated"
- Помилка: "Cannot find module '@prisma/client'"

**Рішення:**
- Перевірте, чи в `package.json` є скрипт `postinstall: "prisma generate"`
- Перевірте, чи в `package.json` build команда включає `prisma generate`
- Має бути: `"build": "prisma generate && next build"`

### 3. Міграція бази даних не виконана ❌

**Симптоми:**
- Помилка: "Table does not exist"
- Помилка: "relation does not exist"

**Рішення:**
```bash
# Локально
vercel env pull .env.local
npx prisma db push

# Або через Vercel CLI
vercel env pull
npx prisma db push
```

### 4. Неправильний формат DATABASE_URL ❌

**Симптоми:**
- Помилка підключення до бази даних
- "Connection refused" або "SSL required"

**Рішення:**
- Перевірте формат: `postgresql://user:password@host:port/database?sslmode=require`
- Для Vercel Postgres: використовуйте URL з панелі Vercel
- Переконайтеся, що додано `?sslmode=require` для SSL

### 5. Перевірка логів на Vercel

1. Перейдіть в Vercel Dashboard
2. Виберіть ваш проект
3. Відкрийте **Deployments** → останній деплой → **Logs**
4. Шукайте помилки з ключовими словами:
   - "DATABASE_URL"
   - "Prisma"
   - "Connection"
   - "Table does not exist"

### 6. Тестування підключення до бази даних

Створіть тестовий API route для перевірки:

```typescript
// app/api/test-db/route.ts
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await prisma.$connect()
    const count = await prisma.business.count()
    return NextResponse.json({ 
      success: true, 
      message: 'Database connected',
      businessCount: count 
    })
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 })
  }
}
```

Відкрийте `/api/test-db` в браузері для перевірки.

## Швидка перевірка налаштувань

✅ **Перевірте в Vercel Settings → Environment Variables:**
- `DATABASE_URL` - обов'язково
- `GOOGLE_CLIENT_ID` - опціонально
- `GOOGLE_CLIENT_SECRET` - опціонально

✅ **Перевірте Build Settings:**
- Build Command: `npm run build`
- Install Command: `npm install`
- Output Directory: `.next`

✅ **Перевірте package.json:**
- `"build": "prisma generate && next build"`
- `"postinstall": "prisma generate"`

## Якщо нічого не допомагає

1. Перевірте логи на Vercel
2. Перевірте, чи правильно налаштована база даних
3. Спробуйте виконати міграцію локально з production DATABASE_URL
4. Перевірте, чи всі змінні оточення додані


