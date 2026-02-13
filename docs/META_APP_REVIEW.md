# Meta App Review — налаштування для xbaseonline

Цей документ описує всі URL та кроки, необхідні для проходження перевірки додатка (App Review) у Meta та публікації додатка для Instagram / Facebook Login.

## Базові URL (для Meta for Developers → Настройки → Основное)

| Поле | URL |
|------|-----|
| **Privacy Policy URL** (Політика конфіденційності) | `https://xbase.online/privacy` |
| **Terms of Service URL** (Умови використання) | `https://xbase.online/terms` |
| **User Data Deletion** (Інструкції видалення даних) | `https://xbase.online/data-deletion` |

## Data Deletion Request Callback URL

Для автоматичного видалення даних при запиті користувача з налаштувань Facebook:

**Meta for Developers** → ваш додаток → **Настройки приложения** → **Дополнительно** (Advanced) → поле **Data Deletion Request URL** (URL запиту на видалення даних):

```
https://xbase.online/api/facebook/data-deletion
```

Цей endpoint приймає POST із `signed_request` від Meta, верифікує підпис, видаляє/відключає інтеграції Instagram та Facebook для відповідного користувача і повертає JSON з `url` та `confirmation_code`.

## Домени

- **App Domains** (Домены приложений): `xbase.online`, `www.xbase.online`
- **Valid OAuth Redirect URIs** (Facebook Login): `https://xbase.online/api/instagram/oauth/callback`

## Сценарії використання (Use cases)

Для перевірки потрібен сценарій **«Вход через Facebook»** (Facebook Login) з дозволом `public_profile`. Додаток використовує його для підключення Instagram до кабінету бізнесу (OAuth → отримання сторінки та Instagram Business акаунту).

## Перевірка перед відправкою

1. Переконайтесь, що на продакшені (xbase.online) доступні:
   - https://xbase.online/privacy
   - https://xbase.online/terms
   - https://xbase.online/data-deletion
2. У Vercel задані: `META_APP_ID`, `META_APP_SECRET`, `META_INSTAGRAM_REDIRECT_URI`, `NEXT_PUBLIC_BASE_URL`.
3. У додатку Meta в полі Data Deletion Request URL вказано `https://xbase.online/api/facebook/data-deletion`.
4. Після змін у налаштуваннях додатка натисніть «Сохранить изменения» та при необхідності повторно відправте заявку на перевірку.
