# 🔒 Ізоляція даних між бізнесами

## КРИТИЧНО ВАЖЛИВО: Кожен бізнес має доступ ТІЛЬКИ до своїх даних

### Принцип роботи

При кожній новій реєстрації (Telegram OAuth, Google OAuth, стандартна реєстрація) створюється **унікальний бізнес** з **унікальним ID**. Всі дані (записи, клієнти, послуги, спеціалісти) прив'язуються до `businessId` і **НІКОЛИ не перемішуються**.

### Структура бази даних

Кожна модель має поле `businessId`, яке забезпечує ізоляцію:

```prisma
model Appointment {
  id         String   @id @default(cuid())
  businessId String   // КРИТИЧНО: Прив'язка до бізнесу
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  // ... інші поля
}

model Master {
  id         String   @id @default(cuid())
  businessId String   // КРИТИЧНО: Прив'язка до бізнесу
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  // ... інші поля
}

model Service {
  id         String   @id @default(cuid())
  businessId String   // КРИТИЧНО: Прив'язка до бізнесу
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  // ... інші поля
}
```

### Перевірка businessId в API routes

#### 1. GET запити (отримання даних)

**ВСІ GET запити ОБОВ'ЯЗКОВО вимагають `businessId`:**

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')

  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
  }

  // ВСІГДИ використовуємо businessId в where clause
  const data = await prisma.model.findMany({
    where: { businessId }, // КРИТИЧНО: ізоляція даних
  })
}
```

#### 2. POST запити (створення даних)

**ВСІ POST запити ОБОВ'ЯЗКОВО вимагають `businessId` в body:**

```typescript
export async function POST(request: Request) {
  const body = await request.json()
  const { businessId, ...otherData } = body

  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
  }

  // Перевіряємо, чи бізнес існує
  const business = await prisma.business.findUnique({
    where: { id: businessId }
  })

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  // Створюємо запис з businessId
  const record = await prisma.model.create({
    data: {
      businessId, // КРИТИЧНО: прив'язка до бізнесу
      ...otherData
    }
  })
}
```

#### 3. PATCH/DELETE запити (оновлення/видалення)

**ВСІ PATCH/DELETE запити ОБОВ'ЯЗКОВО перевіряють власність:**

```typescript
import { verifyBusinessOwnership } from '@/lib/middleware/business-isolation'

export async function PATCH(request: Request, { params }) {
  const body = await request.json()
  const { businessId } = body

  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
  }

  // Перевіряємо, чи запис належить цьому бізнесу
  const isOwner = await verifyBusinessOwnership(
    businessId, 
    'model', 
    params.id
  )

  if (!isOwner) {
    return NextResponse.json({ 
      error: 'Record not found or access denied' 
    }, { status: 404 })
  }

  // Оновлюємо ТІЛЬКИ якщо businessId співпадає
  const record = await prisma.model.update({
    where: { 
      id: params.id,
      businessId // Додаткова перевірка на рівні БД
    },
    data: updateData
  })
}
```

### Middleware для ізоляції даних

Створено `lib/middleware/business-isolation.ts` з утилітами:

#### `extractBusinessId(request, body?)`
Витягує `businessId` з query params, body або headers.

#### `validateBusinessId(businessId)`
Перевіряє, чи `businessId` валідний та існує в базі.

#### `requireBusinessId(request, body?)`
Комбінована функція для отримання та валідації `businessId`.

#### `ensureBusinessIsolation(businessId, additionalWhere?)`
Додає `businessId` до where clause для забезпечення ізоляції.

#### `verifyBusinessOwnership(businessId, model, recordId)`
Перевіряє, чи запис належить бізнесу (для PATCH/DELETE).

### Приклад використання

```typescript
import { 
  requireBusinessId, 
  ensureBusinessIsolation,
  verifyBusinessOwnership 
} from '@/lib/middleware/business-isolation'

export async function GET(request: NextRequest) {
  // Отримуємо та валідуємо businessId
  const businessId = await requireBusinessId(request)
  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
  }

  // Забезпечуємо ізоляцію даних
  const where = ensureBusinessIsolation(businessId, { status: 'active' })
  
  const data = await prisma.model.findMany({ where })
  return NextResponse.json(data)
}
```

### Реєстрація нового бізнесу

При реєстрації (Telegram OAuth, Google OAuth, стандартна) створюється:

1. **Унікальний Business** з унікальним `id` (CUID)
2. **Унікальний `businessIdentifier`** (5-значне число)
3. **Унікальний `slug`** для URL
4. **Унікальний `email`**

Всі наступні дані автоматично прив'язуються до `businessId`:

- Appointments (записи)
- Clients (клієнти)
- Services (послуги)
- Masters (спеціалісти)
- TelegramUsers (користувачі Telegram)
- Payments (платежі)
- Broadcasts (розсилки)
- і т.д.

### Важливі правила

1. **НІКОЛИ** не виконувати запити без `businessId`
2. **ЗАВЖДИ** перевіряти `businessId` перед операціями
3. **ЗАВЖДИ** використовувати `businessId` в `where` clause
4. **ЗАВЖДИ** перевіряти власність при PATCH/DELETE
5. **НІКОЛИ** не довіряти `businessId` з клієнта без валідації

### Тестування ізоляції

Для перевірки ізоляції даних:

1. Створіть два бізнеси (через різні методи реєстрації)
2. Створіть дані для кожного бізнесу
3. Переконайтеся, що бізнес A не бачить дані бізнесу B
4. Переконайтеся, що спроба доступу до чужих даних повертає 404

### Автоматична перевірка

Всі API routes автоматично перевіряють `businessId`:

- ✅ `GET /api/appointments?businessId=...`
- ✅ `POST /api/appointments` (з businessId в body)
- ✅ `PATCH /api/appointments/[id]` (з businessId в body + перевірка власності)
- ✅ `DELETE /api/appointments/[id]?businessId=...` (з перевіркою власності)

Аналогічно для всіх інших моделей (masters, services, clients, тощо).

