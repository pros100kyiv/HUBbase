# Опис проекту: Xbase — платформа записів та клієнтів (Barbershop Booking System)

## Що це за проект

**Xbase** — багатотенантна SaaS-платформа для малого бізнесу (барбершопи, салони краси, СТО, автомийки, фітнес, медицина тощо). Кожен бізнес реєструється, отримує власний кабінет і публічну сторінку бронювання за унікальним URL (`/booking/[slug]`). Клієнти бронюють послуги через 5-кроковий візард без реєстрації.

**Назва в коді:** `barbershop-booking-system`  
**Стек:** Next.js 16 (App Router), TypeScript, Prisma, PostgreSQL, Tailwind CSS.

---

## Функціонал

### Для бізнесу (власник / адмін)

| Модуль | Опис |
|--------|------|
| **Реєстрація та вхід** | Email/пароль, Google OAuth, Telegram OAuth. Відновлення паролю. |
| **Dashboard** | Головна панель: щоденний журнал записів, швидкі дії, статистика, завдання, нотатки. |
| **Записи (Appointments)** | Календар записів, створення/редагування, конфлікти, статуси. |
| **Клієнти** | База клієнтів, сегменти, історія візитів, нотатки. |
| **Майстри/спеціалісти** | Профілі, графіки роботи, блоковані періоди, метрики (завантаженість, дохід). |
| **Ціни/послуги** | Список послуг, ціни, тривалість, прив’язка до майстрів. |
| **Розклад** | Налаштування робочих годин бізнесу та майстрів. |
| **Аналітика** | Звіти, дохід, конверсія, експорт. |
| **Налаштування** | Брендинг (кольори, назва, опис), робочі години, інтеграції. |
| **Соцмережі** | Інтеграції (Telegram бот, розсилки, сповіщення). |
| **QR-код** | Генератор QR для посилання на бронювання. |
| **AI-помічник** | Чат для клієнтів (LM Studio) — допомога з вибором часу/послуги. |

### Для клієнтів (публічно)

- **Бронювання** `/booking/[slug]`: 5 кроків — лендінг → послуга → майстер → час → підтвердження.
- Валідація телефону (+380), перевірка конфліктів записів.
- AI-чат для підбору зручного часу (якщо увімкнено бізнесом).

### Адмін-центр (платформа)

- **URL:** `/admin/login` → `/admin/control-center`.
- Перегляд усіх бізнесів, аналітика, фінанси, журнал активності.
- Блокування/розблоковування акаунтів бізнесів, експорт даних.
- Телефонний довідник, інтеграції, реальний час (realtime stats).

### Додаткові можливості

- **Модулі бізнесу** — увімкнення/вимкнення функцій по бізнесу (наприклад, розширена аналітика).
- **Ніші** — тип бізнесу (BARBERSHOP, SALON, STO, CAR_WASH, SPA, FITNESS, MEDICINE, RESTAURANT тощо) для майбутньої спеціалізації UI/логіки.
- **Платежі** — підготовка до LiqPay/Fondy/Portmone.
- **SMS/Email** — розсилки, нагадування (Twilio, SMSC, SendGrid тощо).
- **PWA** — офлайн, встановлення на пристрій.

---

## Структура проекту

```
c:\server\
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Корінь: ThemeProvider, BookingProvider, Toast
│   ├── page.tsx                  # Головна (редирект / login або /dashboard)
│   ├── globals.css
│   ├── admin/                    # Адмін-центр
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── control-center/page.tsx
│   ├── auth/                     # Сторінки авторизації
│   │   └── telegram/page.tsx
│   ├── booking/[slug]/           # Публічне бронювання для клієнтів
│   ├── dashboard/                # Кабінет бізнесу
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Головна дашборду
│   │   ├── main/                 # Щоденний журнал
│   │   ├── appointments/         # Записи
│   │   ├── clients/              # Клієнти
│   │   ├── masters/              # Майстри
│   │   ├── price/                # Послуги/ціни
│   │   ├── schedule/             # Розклад
│   │   ├── analytics/            # Аналітика
│   │   ├── settings/             # Налаштування
│   │   └── social/               # Соцмережі / Telegram
│   ├── login/, register/, forgot-password/, reset-password/
│   ├── qr/[slug]/                # Сторінка QR-коду
│   └── api/                      # API routes
│       ├── admin/                # Адмін: auth, clients, stats, export, block...
│       ├── ai/chat/              # AI-чат (LM Studio)
│       ├── appointments/         # CRUD записів
│       ├── auth/                 # login, register, google, telegram, reset
│       ├── availability/         # Вільні слоти для бронювання
│       ├── business/             # Бізнес: CRUD, block, modules, presence
│       ├── clients/              # Клієнти, сегменти
│       ├── masters/              # Майстри
│       ├── services/             # Послуги
│       ├── telegram/             # Бот: webhook, reminders, users, connection
│       ├── broadcasts/           # Розсилки
│       ├── payments/             # Платежі
│       └── ...
├── components/
│   ├── admin/                    # Картки дашборду, форми записів, сайдбар, статистика
│   ├── ai/                       # AIChatWidget
│   ├── auth/                     # AuthLayout, TelegramLoginButton
│   ├── booking/                  # Кроки бронювання: LandingStep, ServiceStep, MasterStep, TimeStep, FinalStep
│   ├── layout/                   # Navbar, AccountProfileButton, XbaseLogo
│   └── ui/                       # button, card, input, toast, modal, confetti
├── contexts/
│   ├── ThemeContext.tsx          # Світла/темна/OLED тема
│   ├── BookingContext.tsx        # Стан бронювання (бізнес, крок, дані)
│   └── NavigationProgressContext.tsx
├── lib/
│   ├── auth.ts                   # JWT, сесії
│   ├── prisma.ts                 # Клієнт Prisma
│   ├── database/                 # RLS helper, ensure-admin-control-center
│   ├── middleware/               # admin-auth, business-isolation
│   ├── services/                 # ai-chat, client-segmentation, email, graph-sync, payment, sms
│   ├── utils/                    # business-identifier, business-modules, device, json
│   └── telegram-enhanced.ts
├── prisma/
│   ├── schema.prisma             # Моделі: Business, Master, Service, Appointment, Client, User...
│   ├── migrations/
│   └── seed.ts
├── scripts/                      # CLI: telegram setup/webhook, db seed/cleanup, business block/list
├── docs/                         # Документація (ADMIN, RLS, MODULES, STYLE_BASE, VERCEL...)
├── public/                       # manifest.json, service worker (PWA)
├── package.json
├── next.config.js
├── tailwind.config.ts
└── README.md
```

---

## Модель даних (коротко)

- **Business** — ядро: slug, email, пароль/OAuth, брендинг, ніша, businessIdentifier, Telegram/SMS/Email/AI/Payment налаштування, робочі години.
- **BusinessUser** — користувачі бізнесу (ролі: OWNER, ADMIN, MANAGER, EMPLOYEE, VIEWER).
- **Master** — майстри; **Service** — послуги; **Appointment** — записи.
- **Client** — клієнти (телефон, ім’я, сегменти); **ClientSegment** — сегменти для розсилок.
- **TelegramUser**, **TelegramBroadcast**, **TelegramReminder** — інтеграція з Telegram.
- **AIChatMessage**, **Broadcast**, **Payment**, **SMSMessage**, **Note**, **BusinessModule**, **AnalyticsReport** тощо.

Усі сутності, прив’язані до бізнесу, ізольовані за `businessId`; на prod використовується **PostgreSQL RLS** (див. `docs/RLS_MULTI_TENANT.md`).

---

## Безпека та багатотенантність

- Паролі: **bcrypt**.
- Ізоляція даних: перевірка `businessId` у API + **Row Level Security (RLS)** у PostgreSQL.
- Адмін-центр: окрема авторизація (`/admin/login`), middleware `admin-auth`.
- Валідація: **Zod**; JWT для сесій.

---

## Як запустити

- `npm install` → `npx prisma generate` → `npx prisma db push` (або міграції).
- `.env`: `DATABASE_URL`, за бажанням `GEMINI_API_KEY`, `NEXT_PUBLIC_APP_URL`, OAuth та SMS/Email ключі.
- `npm run db:seed` — тестові дані.
- `npm run dev` — розробка; `npm run build` та `npm start` — production.

Тестовий бізнес після seed: **admin@045barbershop.com** / **password123**, slug **045-barbershop**.

---

## Підсумок

Проект — це **SaaS для бронювання** з кабінетом бізнесу, публічним візардом бронювання, адмін-центром платформи, багатотенантністю (RLS), модулями за нішами, інтеграціями (Telegram, AI, SMS/Email, платежі) та PWA. Структура: Next.js App Router, API routes у `app/api/`, компоненти та контексти в окремих папках, бізнес-логіка та утиліти в `lib/`, модель даних і міграції в `prisma/`.
