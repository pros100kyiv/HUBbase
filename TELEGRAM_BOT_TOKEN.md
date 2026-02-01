# Налаштування Telegram бота

## Токен бота
```
8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo
```

## Швидке налаштування

### 1. Знайти ID бізнесу

```bash
npm run business:list
```

Або через веб-інтерфейс в налаштуваннях бізнесу.

### 2. Налаштувати бота

```bash
npm run telegram:setup <BUSINESS_ID>
```

Це автоматично:
- Перевірить токен бота
- Збереже токен в базі даних
- Увімкне сповіщення

### 3. Налаштувати webhook

**Для production (замініть на ваш домен):**
```bash
npm run telegram:webhook <BUSINESS_ID>
```

**Для локального тестування (з ngrok):**
```bash
# 1. Запустіть ngrok
ngrok http 3000

# 2. Скопіюйте HTTPS URL

# 3. Налаштуйте webhook
npm run telegram:webhook <BUSINESS_ID>
# Або вручну:
curl -X POST "https://api.telegram.org/bot8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo/setWebhook" \
  -d "url=https://YOUR_NGROK_URL/api/telegram/webhook?businessId=<BUSINESS_ID>"
```

### 4. Реєстрація користувача

Відправте `/start` боту, потім зареєструйте через API:

```bash
POST /api/telegram/register
{
  "businessId": "your-business-id",
  "telegramId": "123456789", // Ваш Telegram ID (можна отримати через @userinfobot)
  "role": "OWNER",
  "firstName": "Ваше ім'я",
  "lastName": "Ваше прізвище"
}
```

## Перевірка

1. Відкрийте бота в Telegram
2. Відправте `/start`
3. Відправте `/help`
4. Відправте `/stats` (якщо маєте права)

## Важливо

⚠️ **Токен бота вже збережено в системі. Не публікуйте його в публічних місцях!**

Для production додайте в `.env`:
```
TELEGRAM_BOT_TOKEN=8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo
```

