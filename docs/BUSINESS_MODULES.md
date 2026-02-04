# Система модулів бізнесу

Система модулів дозволяє додавати та керувати функціональністю для конкретних акаунтів бізнесу.

## Структура

### Модель BusinessModule

```prisma
model BusinessModule {
  id          String    @id @default(cuid())
  businessId  String
  moduleKey   String    // Унікальний ключ модуля
  moduleName  String    // Назва модуля
  isEnabled   Boolean   @default(true)
  settings    String?   // JSON налаштування
  metadata    String?   // JSON метадані
  activatedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([businessId, moduleKey])
}
```

## API Endpoints

### GET `/api/business/modules?businessId={id}`
Отримати всі модулі бізнесу

### POST `/api/business/modules`
Створити або оновити модуль

```json
{
  "businessId": "business-id",
  "moduleKey": "advanced-analytics",
  "moduleName": "Розширена аналітика",
  "isEnabled": true,
  "settings": {
    "customReports": true,
    "exportFormat": "pdf"
  },
  "metadata": {
    "version": "1.0.0",
    "description": "Модуль для розширеної аналітики"
  }
}
```

### DELETE `/api/business/modules?businessId={id}&moduleKey={key}`
Видалити модуль

## Утиліти

### `lib/utils/business-modules.ts`

```typescript
// Перевірити чи модуль активований
const isEnabled = await isModuleEnabled(businessId, 'advanced-analytics')

// Отримати налаштування модуля
const settings = await getModuleSettings(businessId, 'advanced-analytics')

// Активувати модуль
await activateModule(businessId, {
  moduleKey: 'advanced-analytics',
  moduleName: 'Розширена аналітика',
  description: 'Модуль для розширеної аналітики',
  defaultSettings: { customReports: true }
})

// Деактивувати модуль
await deactivateModule(businessId, 'advanced-analytics')

// Отримати всі активні модулі
const modules = await getActiveModules(businessId)
```

## Приклади використання

### Додати нову вкладку/функцію до бізнесу

```typescript
// В компоненті або API
import { isModuleEnabled } from '@/lib/utils/business-modules'

const businessId = 'business-id'

// Перевірити чи модуль активований
if (await isModuleEnabled(businessId, 'custom-reports')) {
  // Показати вкладку "Звіти"
  // Відобразити функціональність
}
```

### Активувати модуль через адмін-панель

```typescript
// POST /api/business/modules
{
  "businessId": "56836",
  "moduleKey": "custom-reports",
  "moduleName": "Кастомні звіти",
  "isEnabled": true,
  "settings": {
    "templates": ["daily", "weekly", "monthly"]
  }
}
```

## Ідентифікація бізнесу

Всі бізнеси мають:
- **Внутрішній ID** (`id`) - CUID для внутрішнього використання
- **Business Identifier** (`businessIdentifier`) - 5-значне число для швидкого пошуку (наприклад: 56836)

### Пошук бізнесу

API `/api/business/[param]` підтримує пошук за:
- `businessIdentifier` (число) - пріоритет
- `id` (CUID/UUID)
- `email`
- `slug`

### Приклад

```typescript
// Пошук за businessIdentifier
GET /api/business/56836

// Пошук за ID
GET /api/business/cml5wbva500006n9pl0wzo9l9

// Пошук за email
GET /api/business/diachenko333@telegram.xbase.online

// Пошук за slug
GET /api/business/test-5
```

## Telegram OAuth

Telegram OAuth автоматично:
- Генерує `businessIdentifier` при реєстрації
- Оновлює `businessIdentifier` при вході (якщо відсутній)
- Повертає `businessIdentifier` в відповіді

Всі акаунти мають унікальний `businessIdentifier` для швидкої ідентифікації та налаштувань.

