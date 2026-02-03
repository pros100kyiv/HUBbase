# 🗄️ PostgreSQL Setup - Критично важлива конфігурація

## Поточна конфігурація

Система використовує **PostgreSQL** через **Neon.tech** як хмарну базу даних.

### Prisma Schema

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Змінна оточення

```env
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
```

## Критично важливі вимоги

### 1. ManagementCenter - Повне дублювання даних

**ВСІ новостворені бізнеси АВТОМАТИЧНО дублюються в ManagementCenter:**

- ✅ Стандартна реєстрація → автоматично в ManagementCenter
- ✅ Telegram OAuth → автоматично в ManagementCenter
- ✅ Google OAuth → автоматично в ManagementCenter

**ManagementCenter містить ПОВНУ копію всіх даних з Business:**
- Всі основні поля (name, email, phone, address, description, logo, avatar)
- Всі налаштування (colors, niche, businessIdentifier, profileCompleted)
- Всі інтеграції (Telegram, AI, SMS, Email, Payments, Reminders)
- Всі дані візитівки (businessCardBackgroundImage, slogan, socialMedia, workingHours, location)

### 2. Автоматична синхронізація

**При створенні бізнесу:**
```typescript
// lib/auth.ts - createBusiness()
await registerBusinessInManagementCenter({
  businessId: business.id,
  business: business, // Повний об'єкт
  registrationType: 'standard' | 'google' | 'telegram',
})
```

**При оновленні бізнесу:**
```typescript
// app/api/business/[param]/route.ts - PATCH
await syncBusinessToManagementCenter(businessId)
```

**При логіні:**
```typescript
// app/api/auth/login/route.ts
await updateLastLogin(businessId)
```

### 3. Синхронізація існуючих бізнесів

Якщо є існуючі бізнеси, які не синхронізовані:

```bash
npm run db:sync-management
```

Цей скрипт:
- Знаходить ВСІ бізнеси в базі
- Синхронізує їх в ManagementCenter з повним дублюванням
- Додає номери телефонів в PhoneDirectory
- Показує статистику синхронізації

### 4. Структура бази даних

**PostgreSQL таблиці:**

1. **Business** - основна таблиця бізнесів
2. **ManagementCenter** - ПОВНЕ дублювання Business (критично важливо!)
3. **PhoneDirectory** - реєстр телефонів (BUSINESS/CLIENT)
4. **GraphNode** - вузли графу (Neo4j-стиль)
5. **GraphRelationship** - зв'язки графу (Neo4j-стиль)
6. Інші таблиці: Client, Master, Service, Appointment, тощо

### 5. Перевірка синхронізації

**Перевірити, чи всі бізнеси в ManagementCenter:**

```sql
SELECT 
  (SELECT COUNT(*) FROM "Business") as total_businesses,
  (SELECT COUNT(*) FROM "ManagementCenter") as total_in_management,
  (SELECT COUNT(*) FROM "Business") - (SELECT COUNT(*) FROM "ManagementCenter") as missing;
```

**Очікуваний результат:**
- `total_businesses` = `total_in_management`
- `missing` = 0

### 6. Критичні точки синхронізації

**Місця створення бізнесів:**

1. ✅ `lib/auth.ts` - `createBusiness()` - стандартна реєстрація
2. ✅ `app/api/auth/register/route.ts` - HTTP реєстрація
3. ✅ `app/api/auth/telegram-oauth/route.ts` - Telegram OAuth
4. ✅ `app/api/auth/google/route.ts` - Google OAuth
5. ✅ `app/api/auth/login/route.ts` - тестовий бізнес (якщо не існує)

**Місця оновлення бізнесів:**

1. ✅ `app/api/business/[param]/route.ts` - PATCH запит
2. ✅ `app/dashboard/settings/page.tsx` - налаштування через UI

### 7. Обробка помилок

Всі функції синхронізації мають try-catch блоки, щоб не зламати реєстрацію:

```typescript
try {
  await registerBusinessInManagementCenter(...)
} catch (error) {
  console.error('КРИТИЧНА ПОМИЛКА: Не вдалося синхронізувати:', error)
  // Не викидаємо помилку, щоб не зламати реєстрацію
}
```

### 8. Моніторинг

**Перевірка статусу:**

```bash
# Синхронізувати всі бізнеси
npm run db:sync-management

# Перевірити кількість записів
# В ManagementCenter має бути стільки ж записів, скільки в Business
```

### 9. Важливі зауваження

⚠️ **КРИТИЧНО ВАЖЛИВО:**
- Всі нові бізнеси ОБОВ'ЯЗКОВО мають бути в ManagementCenter
- ManagementCenter - це ПОВНА копія Business
- При оновленні Business автоматично оновлюється ManagementCenter
- Всі акаунти критично важливі для системи

✅ **Гарантії:**
- PostgreSQL забезпечує надійність даних
- ManagementCenter забезпечує централізоване управління
- Автоматична синхронізація забезпечує актуальність даних

