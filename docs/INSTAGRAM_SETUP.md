# Підключення Instagram у кабінеті

Листи з Instagram Direct приходять у кабінет (Соціальні мережі), можна відповідати з інтерфейсу.

## Змінні оточення

Додайте в `.env`:

```env
# Meta (Facebook) додаток для Instagram
META_APP_ID=ваш_app_id
META_APP_SECRET=ваш_app_secret

# Опційно: callback після OAuth (за замовчуванням: NEXT_PUBLIC_BASE_URL + /api/instagram/oauth/callback)
# META_INSTAGRAM_REDIRECT_URI=https://your-domain.com/api/instagram/oauth/callback

# Токен для перевірки webhook (будь-який рядок; той самий вкажіть в Meta App → Webhooks)
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=xbase-instagram-verify
```

## Налаштування Meta

1. **developers.facebook.com** → створіть додаток (або використовуйте існуючий).
2. **Facebook Login** → Settings → Valid OAuth Redirect URIs:  
   `https://ваш-домен/api/instagram/oauth/callback` (для локальної перевірки можна тимчасово `http://localhost:3000/api/instagram/oauth/callback`).
3. **Instagram** (або Messenger) → додайте продукт, якщо потрібно.
4. **Webhooks** → підписка на **instagram**:
   - Callback URL: `https://ваш-домен/api/instagram/webhook`
   - Verify Token: те саме значення, що й `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`.
   - Підписка на поля: **messages**, **messaging_postbacks** (за потреби).
5. У бізнес-акаунті Instagram має бути прив’язана **Facebook-сторінка** (Settings → Linked accounts).

## Поведінка

- Користувач у кабінеті натискає **Підключити** біля Instagram → редірект на Facebook OAuth → підтвердження → повертається в кабінет, статус «Підключено».
- Вхідні повідомлення в Direct надходять на webhook і зберігаються в кабінеті (разом з Telegram).
- Відповіді з кабінету відправляються в Instagram через Graph API.
