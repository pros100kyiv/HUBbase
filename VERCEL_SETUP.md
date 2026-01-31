# Налаштування проекту на Vercel

## Критичні кроки для роботи на Vercel

### 1. Створення PostgreSQL бази даних

SQLite не працює на Vercel, оскільки файли не зберігаються між деплоями. Потрібна PostgreSQL база.

**Варіанти:**
- **Vercel Postgres** (рекомендовано) - інтеграція прямо в Vercel
- **Neon** - безкоштовний tier, швидкий
- **Supabase** - безкоштовний tier
- **Railway** - простий у використанні

### 2. Налаштування змінних оточення на Vercel

1. Перейдіть в **Settings → Environment Variables** вашого проекту на Vercel
2. Додайте наступні змінні:

#### Обов'язкові:
```
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```

#### Опціональні (для Google OAuth):
```
GOOGLE_CLIENT_ID=ваш_client_id
GOOGLE_CLIENT_SECRET=ваш_client_secret
NEXT_PUBLIC_BASE_URL=https://ваш-домен.vercel.app
```

#### Для Google Gemini (якщо використовується):
```
GOOGLE_GENERATIVE_AI_API_KEY=ваш_api_key
```

### 3. Налаштування Build Settings

Переконайтеся, що в Vercel налаштовано:
- **Build Command:** `npm run build` (вже включає `prisma generate`)
- **Install Command:** `npm install`
- **Output Directory:** `.next`
- **Node.js Version:** 18.x або 20.x

### 4. Після першого деплою

Після успішного деплою потрібно виконати міграцію бази даних:

**Варіант 1: Через Vercel CLI**
```bash
# Встановіть Vercel CLI
npm i -g vercel

# Завантажте змінні оточення
vercel env pull .env.local

# Виконайте міграцію
npx prisma db push
```

**Варіант 2: Через Vercel Dashboard**
1. Перейдіть в **Storage → Postgres**
2. Відкрийте консоль бази даних
3. Виконайте SQL команди з міграції

**Варіант 3: Через Prisma Studio (локально)**
```bash
vercel env pull .env.local
npx prisma studio
```

### 5. Перевірка роботи

Після налаштування перевірте:
1. ✅ Відкрийте сайт на Vercel
2. ✅ Спробуйте зареєструватися
3. ✅ Перевірте, чи зберігаються дані
4. ✅ Перевірте логи в **Deployments → Logs**

## Структура бази даних

Всі дані зберігаються в PostgreSQL:

- **Business** - реєстрація бізнесів, налаштування
- **Master** - профілі майстрів, графіки роботи
- **Service** - список послуг, ціни
- **Appointment** - всі бронювання клієнтів

Дані зберігаються **постійно**, навіть після перезапуску сервера.

## Troubleshooting

### Помилка: "Prisma Client not generated"
- Перевірте, чи виконується `prisma generate` в build команді
- Перевірте логи збірки на Vercel

### Помилка: "Can't reach database server"
- Перевірте `DATABASE_URL` в Environment Variables
- Перевірте, чи база даних активна
- Перевірте SSL налаштування (`?sslmode=require`)

### Помилка: "Table does not exist"
- Виконайте міграцію: `npx prisma db push`
- Перевірте, чи правильно налаштована схема в `prisma/schema.prisma`

### Реєстрація не працює
- Перевірте логи API routes в Vercel
- Перевірте, чи правильно налаштована база даних
- Перевірте, чи є помилки в консолі браузера

## Підтримка

Якщо виникли проблеми:
1. Перевірте логи в Vercel Dashboard
2. Перевірте змінні оточення
3. Перевірте статус бази даних
4. Перевірте, чи правильно виконана міграція

