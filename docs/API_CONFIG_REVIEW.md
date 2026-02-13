# Перевірка налаштування API

## Що перевірено

### Авторизація
- **Admin-маршрути** (`/api/admin/*`) — усі використовують `verifyAdminToken`, повертають 401 при відсутньому/невалідному токені.
- **Auth** — register, login, telegram-oauth, forgot-password, reset-password, set-password: валідація body (zod або перевірка полів), безпечна обробка помилок.
- **Реєстрація** — retry при помилках з’єднання з БД (до 3 спроб з паузою 2 с), приховані технічні повідомлення.

### Бізнес та блокування
- **POST /api/business/block** — додано перевірку адмін-токена; без токена повертається 401. Control center передає `getAuthHeaders()`.
- **GET /api/business/block** — залишено без адмін-токена для перевірки статусу блокування з дашборду (businessId у query).
- **DELETE/POST /api/business/delete** — вимагають адмін-токен, повне видалення пов’язаних даних та Telegram deleteWebhook.

### Тіло запиту (JSON)
- **POST /api/telegram/webhook** — додано безпечний парсинг `request.json()`: при невалідному JSON повертається 400 замість 500.
- **PATCH /api/admin/control-center** — додано перевірку на наявність та тип body перед використанням.

### Ідентифікація бізнесу
- **resolveBusinessId** — підтримує businessIdentifier (число), id (CUID), email, slug.
- Маршрути, що приймають `businessId` у body або query, перевіряють його наявність і (де потрібно) існування в БД.

### Змінні оточення (орієнтовний список)
- `DATABASE_URL` — обов’язково для Prisma.
- `JWT_SECRET` — для адмін-токенів (за замовчуванням є fallback; у продакшені краще задати свій).
- `NEXT_PUBLIC_BASE_URL` або `VERCEL_URL` — для OAuth redirect (Google, Telegram).
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — для Google OAuth.
- `DEFAULT_TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_TOKEN` — для Telegram-бота та OAuth.

## Внесені зміни

1. **app/api/business/block/route.ts** — POST вимагає `Authorization: Bearer <admin token>`; без нього 401.
2. **app/api/telegram/webhook/route.ts** — безпечний парсинг body, при невалідному JSON/payload повертається 400.
3. **app/api/admin/control-center/route.ts** — PATCH перевіряє наявність та тип body перед обробкою.

## Рекомендації

- У продакшені встановити `JWT_SECRET` у змінних оточення.
- Для webhook (Telegram, Instagram) переконатися, що URL та секрети збігаються з налаштуваннями у відповідних кабінетах.
