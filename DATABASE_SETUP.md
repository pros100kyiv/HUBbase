# Налаштування бази даних

## Помилка: "Помилка підключення до бази даних: Перевірте налаштування DATABASE_URL"

### Швидке вирішення:

1. **Перевірте наявність файлу `.env`**
   ```bash
   # Якщо файлу немає, створіть його
   ```

2. **Додайте DATABASE_URL в `.env` файл**

   **Для локальної розробки (SQLite):**
   ```env
   DATABASE_URL="file:./prisma/dev.db"
   ```

   **Для production (PostgreSQL):**
   ```env
   DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
   ```

3. **Перевірте підключення:**
   ```bash
   npm run db:test
   ```

4. **Створіть структуру бази даних:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

## Детальні інструкції

### Варіант 1: Локальна розробка з SQLite

1. Створіть файл `.env` в корені проекту:
   ```env
   DATABASE_URL="file:./prisma/dev.db"
   ```

2. Виконайте:
   ```bash
   npm run db:generate
   npm run db:push
   ```

3. Перевірте:
   ```bash
   npm run db:test
   ```

### Варіант 2: PostgreSQL (для production)

1. Створіть базу даних PostgreSQL:
   - Vercel Postgres
   - Neon
   - Supabase
   - Railway
   - Або інша

2. Отримайте connection string (DATABASE_URL)

3. Додайте в `.env`:
   ```env
   DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
   ```

4. Виконайте міграцію:
   ```bash
   npm run db:generate
   npm run db:push
   ```

5. Перевірте:
   ```bash
   npm run db:test
   ```

## Перевірка налаштувань

### Команда для перевірки:
```bash
npm run db:test
```

Ця команда перевірить:
- ✅ Наявність DATABASE_URL
- ✅ Підключення до бази даних
- ✅ Структуру таблиць
- ✅ Наявність даних

## Типові помилки

### "DATABASE_URL не знайдено"
**Рішення:** Створіть файл `.env` з DATABASE_URL

### "Can't reach database server"
**Рішення:** 
- Перевірте, чи запущена база даних
- Перевірте правильність DATABASE_URL
- Перевірте мережеві налаштування

### "Table does not exist"
**Рішення:** Виконайте `npx prisma db push`

### "Column does not exist"
**Рішення:** Виконайте міграцію з `prisma/migrations/add_business_card_fields.sql`

## Додаткова інформація

- Документація Prisma: https://www.prisma.io/docs
- Налаштування Vercel: [VERCEL_SETUP.md](./VERCEL_SETUP.md)
- Міграція полів візитівки: [MIGRATION_INSTRUCTIONS.md](./MIGRATION_INSTRUCTIONS.md)
