# База стилю: Dashboard

**Dashboard — єдина база для стилю та макету всього проєкту.**

Усі сторінки дашборду (Записи, Клієнти, Спеціалісти, Аналітика, Налаштування тощо) **обов’язково** наслідують макет і стиль головної сторінки Dashboard (`/dashboard/main`). Новий функціонал і редизайн сторінок робляться **тільки** з оглядкою на Dashboard.

---

## Правила

### 1. Сітка
- Контейнер: `max-w-7xl mx-auto`
- Сітка: `grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-6`
- Основний контент: `lg:col-span-3`
- Правий сайдбар: `lg:col-span-1`
- Вертикальні відступи між блоками: `space-y-3 md:space-y-6`

### 2. Заголовок сторінки
- Один рядок: `text-xl md:text-2xl font-bold text-white` з `letterSpacing: '-0.02em'`
- Справа — головна кнопка дії (наприклад «Записати»): білий фон, чорний текст, `rounded-lg`, тінь `0 2px 4px 0 rgba(0, 0, 0, 0.3)`, `px-4 py-2`, `text-sm font-semibold`, `active:scale-[0.98]`

### 3. Картки
- Клас: `rounded-xl p-4 md:p-6 card-floating`
- Заголовки всередині карток: `text-base md:text-lg font-semibold` або `text-lg font-bold`, `letterSpacing: '-0.02em'` / `-0.01em`

### 4. Кнопки
- **Головна дія:** `bg-white text-black`, тінь як вище, `font-semibold`, `hover:bg-gray-100`, `active:scale-[0.98]`
- **Другорядні:** `border border-white/20 bg-white/10 text-white`, `hover:bg-white/20`, `rounded-lg`, `text-sm font-medium`

### 5. Теми та кольори
- Темний фон сторінки (глобально), картки — напівпрозорі темні (`card-floating`), текст білий/сірий.
- Акценти статусів: orange (очікує), green (підтверджено), blue (виконано), purple (дохід) — без зміни загальної палітри.

### 6. Мобільна версія
- На мобільних головна кнопка може стояти поруч із заголовком (як «Записати» на Dashboard).
- Сітка зводиться до однієї колонки, сайдбар — під основний контент.

---

## Файли-еталони

| Що | Файл |
|----|------|
| Головна Dashboard | `app/dashboard/main/page.tsx` |
| Макет (navbar, sidebar, контент) | `app/dashboard/layout.tsx` |
| Стиль карток | `components/admin/MyDayCard.tsx`, `TasksInProcessCard.tsx`, `WeeklyProcessCard.tsx` |
| Глобальні стилі | `app/globals.css`, `tailwind.config.ts` |

Перед зміною стилю сторінки або додаванням нової — перевіряй відповідність цій базі (Dashboard).
