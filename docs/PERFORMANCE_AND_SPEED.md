# Швидкість роботи сайту (Performance)

Цей сайт забезпечує швидку роботу за рахунок **Service Worker** та **Workbox**.

## Що відповідає за швидкість

- **`public/sw.js`** — головний Service Worker: підвантажує Workbox, задає precache та стратегії кешування.
- **`public/workbox-4754cb34.js`** — бібліотека Workbox: маршрутизація запитів, кеш (Cache First, Network First, Stale While Revalidate), очистка застарілого кешу.

## Що кешується

- **Precache** — збірка Next.js (chunks, сторінки, CSS, manifest) для миттєвого завантаження після першого відвідування.
- **Шрифти** (Google Fonts) — Cache First / Stale While Revalidate.
- **Зображення** (jpg, png, svg, webp, `/_next/image`) — Stale While Revalidate.
- **JS/CSS** — Stale While Revalidate.
- **API** (крім `/api/auth/`) — Network First з таймаутом 10 с і fallback на кеш.
- **Сторінки** (не API) — Network First з таймаутом 10 с.

Таким чином саме **Service Worker і Workbox** відповідають за швидкість роботи сайту: повторні відкриття та повторні запити обслуговуються з кешу, що зменшує навантаження на мережу та прискорює завантаження.

## Оптимізації коду (швидке перше завантаження)

- **Бронювання** — бізнес завантажується на **сервері** (`lib/booking-fetch-business.ts`), клієнт отримує дані в HTML — без client-side API round-trip.
- **Next.js** — `optimizePackageImports` для `date-fns`, `@radix-ui/*` (менший bundle), `compress: true`, без `X-Powered-By`.
- **Dashboard** — AIChatWidget, ProfileSetupModal, BlockedOverlay підвантажуються динамічно (lazy), щоб не тягнути їх у початковий JS.
- **Navbar** — GlobalSearch та NotificationsPanel підвантажуються при першому відкритті пошуку/сповіщень.
- **Бронювання** — бізнес з сервера; кроки 2–5 (послуга, майстер, час, підсумок) lazy-loaded по мірі переходу; LandingStep одразу.
- **QR-сторінка** — бібліотека `qrcode.react` підвантажується тільки на цій сторінці (dynamic import).
- **BookingContext** — колбеки та value провайдера мемоїзовані (`useCallback`/`useMemo`), щоб зменшити зайві ре-рендери.
- **Loading UI** — `app/loading.tsx` (глобальний), `app/dashboard/loading.tsx` (skeleton), `app/booking/[slug]/loading.tsx`.
