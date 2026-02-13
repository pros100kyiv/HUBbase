# Тарифні плани та trial

## Огляд

- **Trial:** кожен новий бізнес отримує **14 днів** безкоштовного trial (налаштовується через `TRIAL_DAYS` у `.env`).
- **Тарифи:** FREE, Старт, Бізнес, Про. Керування — у **Центрі управління** → вкладка **«Підписки»**.

## Тарифи

| Тариф      | Ключ     | Майстрів | Аналітика | Telegram | Instagram | AI-чат |
|------------|----------|----------|-----------|----------|-----------|--------|
| Безкоштовний | FREE     | 1        | —         | так      | —         | —      |
| Старт      | START    | 1        | —         | так      | —         | —      |
| Бізнес     | BUSINESS | до 5     | так       | так      | —         | —      |
| Про        | PRO      | до 50    | так       | так      | так       | так    |

## Де керувати

**У кабінеті бізнесу:** бокова панель → **Система** → **Підписка** (`/dashboard/subscription`). Там видно поточний тариф, trial (дата та дні), що включено в план. Змінити тариф може лише адмін.

**В адмін-центрі:** увійти в **Центр управління** → `/admin/login`.
2. Відкрити вкладку **«Підписки»**.
3. Фільтри: за тарифом (Всі / Безкоштовний / Старт / Бізнес / Про), за trial (Усі / На trial / Trial закінчився).
4. Кнопка **«Змінити»** біля бізнесу:
   - вибрати **тариф** (FREE, START, BUSINESS, PRO);
   - **Продовжити trial** — вказати кількість днів (0 = не змінювати).
5. **Зберегти** — зміни застосовуються одразу.

## Технічно

- Поля в БД (модель `Business`): `subscriptionPlan`, `trialEndsAt`, `subscriptionStatus`, `subscriptionCurrentPeriodEnd`.
- Логіка та ліміти: `lib/subscription.ts` (`getSubscriptionState`, `SUBSCRIPTION_PLAN_LIMITS`, `TRIAL_DAYS`).
- API: `PATCH /api/admin/control-center` з `action: 'updateSubscription'` та `data: { subscriptionPlan?, trialEndsAt?, extendTrialDays?, subscriptionStatus? }`.
- При реєстрації (email, Telegram, Google) автоматично встановлюються `trialEndsAt = now + 14 днів` та `subscriptionStatus = 'trial'`.

## Змінна оточення

```env
TRIAL_DAYS=14
```

Якщо не вказано — використовується 14 днів.
