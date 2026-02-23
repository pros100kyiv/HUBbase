# E2E тести (Playwright)

Професійне E2E тестування в реальному браузері через термінал.

## Швидкий старт

```bash
npm run test:e2e
```

Якщо dev-сервер уже запущений (`npm run dev`) — Playwright його використає. Якщо ні — запустить сам (займає 10–20 с).

## Скрипти

| Команда | Опис |
|---------|------|
| `npm run test:e2e` | Всі тести в headless режимі |
| `npm run test:e2e:headed` | Тести з видимим браузером |
| `npm run test:e2e:ui` | Інтерактивний UI Playwright |
| `npm run test:e2e:debug` | Дебаг з кроковим виконанням |
| `npm run test:e2e:report` | Відкрити HTML-звіт після прогону |
| `npm run test:e2e:critical` | Швидкий smoke (тільки smoke.spec.ts) |
| `npm run test:e2e:smoke` | Тести з тегом @smoke |

## Тестові дані

За замовчуванням використовується тестовий бізнес:
- Email: `admin@045barbershop.com`
- Password: `password123`
- Slug: `045-barbershop`

Змінні оточення: `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `E2E_TEST_SLUG`.

## Структура тестів

- `smoke.spec.ts` — базова доступність, title, viewport, charset, manifest
- `auth.spec.ts` — вхід, реєстрація, редиректи, захищені маршрути
- `pages.spec.ts` — вміст сторінок (terms, privacy, booking, qr, test-flow, auth/telegram…)
- `booking.spec.ts` — флоу бронювання, landing → master step, кнопка Головна
- `dashboard.spec.ts` — main, appointments, clients, settings, analytics, social, price, schedule, subscription
- `visual.spec.ts` — overflow, viewports (десктоп 1920/1440/1280, планшет 768, мобільні 414/390/375/320), touch targets
- `accessibility.spec.ts` — landmarks, labels, alt, autocomplete, required, focus outline
- `axe.spec.ts` — axe-core аудит a11y (критичні порушення)
- `seo.spec.ts` — meta title/description, Open Graph, robots, theme-color, skip link, JSON-LD
- `navigation.spec.ts` — footer/header links, Забули пароль, На головну
- `forms.spec.ts` — валідація (email, пароль, required)
- `api-health.spec.ts` — API business/services/login, 404
- `error-states.spec.ts` — невалідний slug, 404, редіректи без сесії
- `comprehensive.spec.ts` — **повна перевірка** усіх вкладок, візуальних елементів, overflow, console errors

## Запуск окремих файлів

```bash
npx playwright test e2e/tests/auth.spec.ts
npx playwright test e2e/tests/smoke.spec.ts --project=chromium
```

## CI

В CI Playwright автоматично збирає проект і запускає `npm run start`. Workflow: `.github/workflows/e2e.yml` (push/PR на main). Звіти зберігаються як артефакти.

## Global setup

`e2e/global-setup.ts` — перевірка доступності тестового бізнесу через API (опційно).
