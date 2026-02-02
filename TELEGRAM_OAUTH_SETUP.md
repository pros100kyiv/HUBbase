# Налаштування Telegram OAuth

## Опис

Telegram OAuth дозволяє швидко підключити ваш Telegram акаунт до Xbase для отримання сповіщень та управління ботом безпосередньо з веб-інтерфейсу.

## Що було виправлено

1. **Покращена обробка помилок** - компонент тепер правильно обробляє всі помилки та показує зрозумілі повідомлення
2. **Автоматичне отримання імені бота** - система автоматично отримує ім'я бота з Telegram API
3. **Валідація даних** - додано перевірку всіх вхідних даних
4. **Покращена обробка станів** - компонент правильно відображає різні стани (завантаження, помилки, успіх)

## Налаштування через термінал

### 1. Перевірка налаштувань бота

```bash
npm run telegram:oauth <businessId>
```

Приклад:
```bash
npm run telegram:oauth cml3hv43g000011zklyvox6sh
```

### 2. Налаштування з новим токеном

```bash
npm run telegram:oauth <businessId> <botToken>
```

Приклад:
```bash
npm run telegram:oauth cml3hv43g000011zklyvox6sh 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
```

## Налаштування в @BotFather

1. Відкрийте [@BotFather](https://t.me/botfather) в Telegram
2. Виберіть вашого бота
3. Оберіть "Edit Bot" → "Edit Domains"
4. Додайте домен вашого сайту (наприклад: `xbase.online`)

**Важливо:** Домен повинен бути доступний через HTTPS.

## Використання в інтерфейсі

1. Відкрийте налаштування бізнесу (`/dashboard/settings`)
2. Перейдіть до вкладки "Telegram"
3. У розділі "Telegram OAuth" натисніть "Підключити Telegram"
4. Авторизуйтеся через Telegram Login Widget
5. Після успішної авторизації ваш Telegram акаунт буде підключено

## API Endpoints

### GET `/api/telegram/bot-name?businessId=<id>`
Отримує ім'я бота з бази даних та Telegram API.

**Відповідь:**
```json
{
  "botName": "your_bot",
  "botId": 123456789,
  "firstName": "Your Bot"
}
```

### GET `/api/telegram/connection?businessId=<id>`
Перевіряє статус підключення Telegram.

**Відповідь:**
```json
{
  "connected": true,
  "user": {
    "id": "...",
    "telegramId": "123456789",
    "username": "username",
    "firstName": "Name",
    "lastName": "Surname"
  }
}
```

### POST `/api/telegram/oauth`
Підключає Telegram акаунт до бізнесу.

**Тіло запиту:**
```json
{
  "businessId": "...",
  "telegramData": {
    "id": 123456789,
    "first_name": "Name",
    "last_name": "Surname",
    "username": "username",
    "photo_url": "..."
  }
}
```

### DELETE `/api/telegram/oauth`
Відключає Telegram акаунт від бізнесу.

**Тіло запиту:**
```json
{
  "businessId": "..."
}
```

## Структура бази даних

### SocialIntegration
Зберігає інформацію про інтеграцію з Telegram:
- `platform`: 'telegram'
- `isConnected`: true/false
- `userId`: Telegram user ID
- `username`: Telegram username
- `metadata`: JSON з додатковою інформацією

### TelegramUser
Зберігає інформацію про користувача Telegram:
- `telegramId`: BigInt (Telegram user ID)
- `username`: Telegram username
- `firstName`: Ім'я
- `lastName`: Прізвище
- `role`: 'OWNER' (для OAuth підключення)

## Усунення проблем

### Помилка: "Telegram бот не налаштований"
**Рішення:**
1. Переконайтеся, що токен бота встановлено в налаштуваннях бізнесу
2. Запустіть `npm run telegram:oauth <businessId>` для перевірки

### Помилка: "Не вдалося завантажити Telegram Widget"
**Рішення:**
1. Переконайтеся, що домен додано в @BotFather
2. Перевірте, що сайт доступний через HTTPS
3. Перевірте консоль браузера на наявність помилок CORS

### Помилка: "Некоректні дані від Telegram"
**Рішення:**
1. Спробуйте відключити та підключити знову
2. Переконайтеся, що ви авторизуєтеся через правильний Telegram акаунт
3. Перевірте, що бот активний в @BotFather

### Помилка: "Application error: a client-side exception has occurred"
**Рішення:**
1. Перевірте консоль браузера (F12) для деталей помилки
2. Переконайтеся, що всі залежності встановлено: `npm install`
3. Перезапустіть dev сервер: `npm run dev`
4. Очистіть кеш браузера та перезавантажте сторінку

## Технічні деталі

### Компонент TelegramOAuth
- Автоматично отримує ім'я бота з API
- Показує стан підключення
- Обробляє всі помилки
- Підтримує відключення

### Безпека
- Всі дані валідуються на сервері
- Telegram ID перевіряється перед збереженням
- Унікальність підключення забезпечується через Prisma constraints

## Підтримка

Якщо виникли проблеми:
1. Перевірте логи в консолі браузера
2. Перевірте логи сервера
3. Запустіть `npm run telegram:oauth <businessId>` для діагностики
4. Переконайтеся, що всі кроки налаштування виконано правильно

