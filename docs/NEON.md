# Підключення до Neon (PostgreSQL)

## Приклад .env

Скопіюй у `.env` (значення візьми з Neon dashboard):

```env
# Pooled — для додатку (в хості є -pooler)
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require"

# Опційно: Direct — для міграцій (без -pooler)
# DIRECT_URL="postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/DBNAME?sslmode=require"
```

## Що перевірити

1. **DATABASE_URL у `.env`**  
   Має бути connection string з Neon dashboard. Для додатку використовуй **Pooled** (у хості є `-pooler`):
   ```
   postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require
   ```

2. **Міграції**  
   Якщо використовуєш лише pooled URL, `prisma migrate deploy` / `prisma migrate dev` зазвичай працюють.  
   Якщо з’являться помилки, додай **Direct** URL з Neon dashboard у `.env`:
   ```
   DIRECT_URL="postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/DBNAME?sslmode=require"
   ```
   (у хості **без** `-pooler`). Потім у `prisma/schema.prisma` в блоці `datasource db` додай:
   ```
   directUrl = env("DIRECT_URL")
   ```

3. **Перевірка підключення**  
   ```bash
   npx tsx scripts/verify-neon-connection.ts
   ```

## Оптимізація для serverless (Vercel)

- **Pooled** — обов'язково URL з `-pooler` у хості.
- **connection_limit=1** — на Vercel додаток автоматично додає цей параметр (менше з'єднань).
- **directUrl** — опційно для міграцій (Direct connection без -pooler).

## Prisma

- У `schema.prisma`: `provider = "postgresql"`, `url = env("DATABASE_URL")`.
- Клієнт у `lib/prisma.ts` — один екземпляр на процес + auto `connection_limit=1` на Vercel.

## Якщо не підключається

- Переконайся, що в Neon у проєкті ввімкнено **Allow external connections** (або додай IP у allow list, якщо використовується).
- У рядку підключення має бути `?sslmode=require` (Neon вимагає SSL).
