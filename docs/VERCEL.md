# Підключення проєкту до Vercel

Проєкт налаштований для деплою на Vercel (Next.js).

## Варіант 1: Через Vercel Dashboard (рекомендовано)

1. Зайдіть на [vercel.com](https://vercel.com) і увійдіть в акаунт.
2. **Add New…** → **Project**.
3. Імпортуйте репозиторій з GitHub/GitLab/Bitbucket (підключіть акаунт, якщо потрібно).
4. Виберіть репозиторій `c:\server` (або як він названий у вас).
5. Vercel підставить:
   - **Framework Preset:** Next.js
   - **Build Command:** `prisma generate && next build`
   - **Output Directory:** (за замовчуванням для Next.js)
6. Додайте **Environment Variables** у налаштуваннях проєкту (база даних, API-ключі тощо).
7. Натисніть **Deploy**.

Після цього кожен push у вибрану гілку буде запускати новий деплой.

## Варіант 2: Через Vercel CLI

1. Встановіть CLI (один раз):
   ```bash
   npm i -g vercel
   ```

2. Прив’яжіть проєкт до Vercel (токен не зберігається в репо, тільки в середовищі):
   ```powershell
   cd c:\server
   $env:VERCEL_TOKEN="ваш_токен_з_vercel"
   vercel link --yes
   ```

3. Задеплойте:
   ```bash
   vercel
   ```
   або в продакшн:
   ```bash
   vercel --prod
   ```

Токен можна взяти в Vercel: **Account Settings → Tokens → Create**.

## Змінні середовища на Vercel

У **Project → Settings → Environment Variables** додайте всі змінні, які використовує проєкт, зокрема:

- `DATABASE_URL` — рядок підключення до PostgreSQL (для Vercel потрібна хмарна БД, не локальний файл).
- Інші ключі (Telegram, Google OAuth тощо) з вашого `.env` / `.env.local`.

**Увага:** Токен Vercel (якщо ви його використовували) не додавайте в код і не комітьте в репозиторій. Використовуйте його тільки локально в `VERCEL_TOKEN` або в налаштуваннях CI/CD.

## Prisma на Vercel

У `package.json` вже є:

- `"build": "prisma generate && next build"`
- `"postinstall": "prisma generate"`

У `vercel.json` build-команда: `prisma generate && next build` (без `migrate deploy`, щоб уникнути помилки P3005, коли БД вже має схему).

**Міграції:** під час збірки на Vercel міграції не запускаються. Якщо додали нову міграцію — один раз виконайте локально з продакшн-URL:
```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```
або `npm run db:migrate-deploy`, встановивши в середовищі `DATABASE_URL` на продакшн-базу.

Для продакшну потрібна PostgreSQL (наприклад, Neon, Supabase). Локальний `prisma/dev.db` на Vercel не використовується.
