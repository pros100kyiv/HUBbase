# Налаштування Google OAuth

## Крок 1: Створення OAuth 2.0 Client ID в Google Cloud Console

1. Перейдіть на [Google Cloud Console](https://console.cloud.google.com/)
2. Створіть новий проект або виберіть існуючий
3. Увімкніть Google+ API:
   - Перейдіть до "APIs & Services" > "Library"
   - Знайдіть "Google+ API" та натисніть "Enable"

4. Створіть OAuth 2.0 Client ID:
   - Перейдіть до "APIs & Services" > "Credentials"
   - Натисніть "Create Credentials" > "OAuth client ID"
   - Якщо це перший раз, налаштуйте OAuth consent screen:
     - Application type: Web application
     - Name: Ваша назва додатку
     - Authorized JavaScript origins: `http://localhost:3000` (для dev)
     - Authorized redirect URIs: `http://localhost:3000/api/auth/google`

5. Після створення скопіюйте:
   - Client ID
   - Client Secret

## Крок 2: Додайте змінні оточення

Додайте до файлу `.env`:

```env
GOOGLE_CLIENT_ID=ваш_client_id
GOOGLE_CLIENT_SECRET=ваш_client_secret
```

Для production також додайте:
```env
NEXT_PUBLIC_BASE_URL=https://ваш-домен.com
```

## Крок 3: Оновіть базу даних

Запустіть міграцію:
```bash
npx prisma db push
npx prisma generate
```

## Крок 4: Перезапустіть сервер

```bash
npm run dev
```

## Як це працює

1. Користувач натискає кнопку "Увійти через Google" на сторінці логіну/реєстрації
2. Відкривається Google OAuth сторінка для авторизації
3. Після успішної авторизації Google перенаправляє на `/api/auth/google` з кодом
4. Сервер обмінює код на токен та отримує інформацію про користувача
5. Якщо бізнес з таким email вже існує - він входить
6. Якщо ні - створюється новий бізнес з даними з Google
7. Користувач перенаправляється на dashboard

## Примітки

- Для production не забудьте додати production URL до Authorized redirect URIs в Google Cloud Console
- Google ID зберігається в базі даних для майбутніх входів
- Якщо користувач вже має акаунт з email, але без Google ID, Google ID буде додано до існуючого акаунту



