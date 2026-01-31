# ✅ Чеклист налаштування на Vercel

## Крок 1: Створення PostgreSQL бази даних

- [ ] Створити PostgreSQL базу даних (Vercel Postgres, Neon, Supabase, або інша)
- [ ] Скопіювати `DATABASE_URL` з панелі бази даних

## Крок 2: Налаштування змінних оточення на Vercel

Перейдіть в **Settings → Environment Variables** та додайте:

- [ ] `DATABASE_URL` = `postgresql://user:password@host:port/database?sslmode=require`
- [ ] (Опціонально) `GOOGLE_CLIENT_ID` = ваш Google OAuth Client ID
- [ ] (Опціонально) `GOOGLE_CLIENT_SECRET` = ваш Google OAuth Client Secret
- [ ] (Опціонально) `GOOGLE_GENERATIVE_AI_API_KEY` = ваш Gemini API ключ
- [ ] (Опціонально) `NEXT_PUBLIC_BASE_URL` = `https://ваш-домен.vercel.app`

## Крок 3: Перевірка Build Settings

- [ ] Build Command: `npm run build` ✅ (вже налаштовано)
- [ ] Install Command: `npm install` ✅
- [ ] Output Directory: `.next` ✅

## Крок 4: Деплой та міграція

- [ ] Зробити commit та push змін
- [ ] Vercel автоматично збере проект
- [ ] Після успішного деплою виконати міграцію:

```bash
# Встановіть Vercel CLI (якщо ще не встановлено)
npm i -g vercel

# Завантажте змінні оточення
vercel env pull .env.local

# Виконайте міграцію
npx prisma db push
```

## Крок 5: Перевірка роботи

- [ ] Відкрити сайт на Vercel
- [ ] Спробувати зареєструватися
- [ ] Перевірити, чи зберігаються дані
- [ ] Перевірити логи в Vercel Dashboard → Deployments → Logs

## Що зберігається в базі даних?

✅ **Всі дані зберігаються постійно:**
- Бізнеси (реєстрація, налаштування)
- Майстри (профілі, графіки)
- Послуги (список, ціни)
- Записи (всі бронювання)
- Клієнти (дані з записів)

Дані **не втрачаються** після перезапуску сервера!

## Якщо щось не працює

1. Перевірте логи в Vercel Dashboard
2. Перевірте, чи правильно налаштована `DATABASE_URL`
3. Перевірте, чи виконана міграція бази даних
4. Дивіться детальні інструкції в [VERCEL_SETUP.md](./VERCEL_SETUP.md)

