# База стилю: Dashboard

**Dashboard — єдина база для стилю та макету всього проєкту.**

Усі сторінки дашборду (Записи, Клієнти, Спеціалісти, Аналітика, Налаштування тощо) **обов'язково** наслідують макет і стиль головної сторінки Dashboard (`/dashboard/main`). Новий функціонал і редизайн сторінок робляться **тільки** з оглядкою на Dashboard.

---

## Де зберігається база

| Що | Файл |
|----|------|
| **Класи макету та кнопок** | `app/globals.css` — секція `@layer components` (dashboard-container, dashboard-grid, dashboard-btn-primary тощо) |
| **Токени (тіні, letter-spacing)** | `tailwind.config.ts` — `boxShadow.dashboard-button`, `letterSpacing.dashboard-title` / `dashboard-card` |
| **Картки (напівпрозора темна)** | `app/globals.css` — класи `.card-glass`, `.card-glass-subtle`, `.card-glass-elevated` у `@layer base`. `card-floating` — лише для MyDayCard |

**Використовуй класи з бази замість дублювання утиліт у компонентах.**

---

## Правила та класи

### 1. Сітка

Використовуй класи з `globals.css`:

| Призначення | Клас | Еквівалент утиліт |
|-------------|------|-------------------|
| Контейнер сторінки | `dashboard-container` | `max-w-7xl mx-auto` |
| Сітка (контент + сайдбар) | `dashboard-grid` | `grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-6` |
| Основний контент | `dashboard-main` | `lg:col-span-3 space-y-3 md:space-y-6` |
| Правий сайдбар | `dashboard-sidebar` | `lg:col-span-1 space-y-3 md:space-y-6` |

### 2. Заголовок сторінки

- **Клас:** `dashboard-page-title`  
- Зміст: один рядок, справа — головна кнопка дії (наприклад «Записати»).

### 3. Кнопки

| Тип | Клас | Опис |
|-----|------|------|
| Головна дія | `dashboard-btn-primary` | Білий фон, чорний текст, тінь `shadow-dashboard-button`, `rounded-lg`, `px-4 py-2`, `text-sm font-semibold`, `hover:bg-gray-100`, `active:scale-[0.98]` |
| Другорядні | `dashboard-btn-secondary` | `border border-white/20 bg-white/10 text-white`, `hover:bg-white/20`, `rounded-lg`, `text-sm font-medium` |

### 4. Картки

- **Клас картки:** `dashboard-card` (включає `card-glass`) або `card-glass` / `card-glass-subtle` / `card-glass-elevated` + `rounded-xl p-4 md:p-6`. Картки з напівпрозорим фоном адаптуються під будь-яку тему.
  - `card-glass` — стандарт (rgba 0.05), для більшості карток
  - `card-glass-subtle` — більш прозора (0.03), для сайдбару / другорядних
  - `card-glass-elevated` — щільніша (0.08), для акцентних / auth / empty states
- **Заголовки всередині карток:**
  - `dashboard-card-title` — `text-base md:text-lg font-semibold`, letter-spacing `-0.01em`
  - `dashboard-card-title-lg` — `text-lg font-bold`, letter-spacing `-0.02em`

### 5. Теми та кольори

- Темний фон сторінки (глобально в `body`), картки — напівпрозорі темні (`card-glass*` / `dashboard-card`), текст білий/сірий. **ВАЖЛИВО:** картку МІЙ ДЕНЬ не змінюємо — вона використовує `card-floating`.
- Акценти статусів: orange (очікує), green (підтверджено), blue (виконано), purple (дохід) — без зміни загальної палітри.

### 6. Мобільна версія

- На мобільних головна кнопка може стояти поруч із заголовком (як «Записати» на Dashboard).
- Сітка зводиться до однієї колонки, сайдбар — під основний контент (забезпечується `dashboard-grid` та `dashboard-main` / `dashboard-sidebar`).

---

## Файли-еталони

| Що | Файл |
|----|------|
| Головна Dashboard | `app/dashboard/main/page.tsx` |
| Макет (navbar, sidebar, контент) | `app/dashboard/layout.tsx` |
| Стиль карток | `components/admin/MyDayCard.tsx`, `TasksInProcessCard.tsx`, `WeeklyProcessCard.tsx` |
| Глобальні стилі та база | `app/globals.css`, `tailwind.config.ts` |

Перед зміною стилю сторінки або додаванням нової — перевіряй відповідність цій базі (Dashboard) і використовуй класи з `globals.css`.
