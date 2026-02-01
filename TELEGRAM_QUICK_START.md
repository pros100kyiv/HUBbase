# Швидкий старт: Налаштування Telegram бота

## Токен бота
```
8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo
```

## Крок 1: Знайти ID бізнесу

Спочатку потрібно знайти ID вашого бізнесу:

```bash
npm run business:list
```

Або через API:
```bash
GET /api/business/[param]?param=your-email@example.com
```

## Крок 2: Налаштувати бота для бізнесу

```bash
npm run telegram:setup <BUSINESS_ID>
```

Або вручну через API:
```bash
POST /api/telegram/setup
{
  "businessId": "your-business-id",
  "botToken": "8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo",
  "notificationsEnabled": true
}
```

## Крок 3: Налаштувати webhook

Для production (замініть на ваш домен):
```bash
npm run telegram:webhook <BUSINESS_ID>
```

Або вручну:
```bash
curl -X POST "https://api.telegram.org/bot8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo/setWebhook" \
  -d "url=https://your-domain.com/api/telegram/webhook?businessId=<BUSINESS_ID>"
```

Для локального тестування (використовуйте ngrok або інший tunnel):
```bash
# 1. Запустіть ngrok
ngrok http 3000

# 2. Скопіюйте HTTPS URL (наприклад: https://abc123.ngrok.io)

# 3. Налаштуйте webhook
curl -X POST "https://api.telegram.org/bot8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo/setWebhook" \
  -d "url=https://abc123.ngrok.io/api/telegram/webhook?businessId=<BUSINESS_ID>"
```

## Крок 4: Реєстрація користувача

Відправте `/start` боту в Telegram, потім зареєструйте користувача через API:

```bash
POST /api/telegram/register
{
  "businessId": "your-business-id",
  "telegramId": "123456789", // ID користувача з Telegram
  "role": "OWNER", // або ADMIN, MANAGER, EMPLOYEE, VIEWER
  "firstName": "Ім'я",
  "lastName": "Прізвище",
  "username": "username"
}
```

## Крок 5: Тестування

1. Відкрийте бота в Telegram
2. Відправте `/start`
3. Відправте `/help` для списку команд
4. Відправте `/stats` для статистики

## Команди бота

- `/start` - Реєстрація/вхід
- `/help` - Допомога
- `/stats` - Статистика (VIEWER+)
- `/revenue` - Аналітика прибутку (MANAGER+)
- `/alerts` - Сповіщення (MANAGER+)

## Моніторинг

Запустіть моніторинг для автоматичних сповіщень:

```bash
npm run telegram:monitor
```

Або налаштуйте cron (кожні 30 хвилин):
```bash
*/30 * * * * cd /path/to/project && npm run telegram:monitor
```

## Перевірка webhook

```bash
curl "https://api.telegram.org/bot8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo/getWebhookInfo"
```

## Важливо

⚠️ **Не публікуйте токен бота в публічних репозиторіях!**

Зберігайте токен в:
- Environment variables (`.env`)
- Vercel Environment Variables
- Безпечних сховищах

## Підтримка

Якщо виникли проблеми:
1. Перевірте чи бот активний: `getMe`
2. Перевірте webhook: `getWebhookInfo`
3. Перевірте логи: `TelegramLog` в базі даних
4. Перевірте чи `businessId` правильний

