# Значення змінних оточення для Vercel

## ⚠️ ВАЖЛИВО: Додайте ці значення в Vercel Dashboard

Перейдіть: **Vercel Dashboard → ваш проект → Settings → Environment Variables**

## Обов'язкові змінні:

### DATABASE_URL
```
postgresql://neondb_owner:npg_9VohXeW6nPIM@ep-cold-bar-agx5y4cp-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

## Опціональні змінні (якщо використовуєте):

### GOOGLE_CLIENT_ID
```
ваш_google_client_id
```

### GOOGLE_CLIENT_SECRET
```
ваш_google_client_secret
```

### NEXT_PUBLIC_BASE_URL
```
https://hu-bbase-wue8.vercel.app
```
(або ваш основний домен на Vercel)

### GOOGLE_GENERATIVE_AI_API_KEY
```
ваш_gemini_api_key
```

## Як додати:

1. Відкрийте Vercel Dashboard
2. Виберіть проект `hu-bbase-wue8` (або ваш проект)
3. Settings → Environment Variables
4. Натисніть "Add New"
5. Додайте кожну змінну окремо:
   - Key: `DATABASE_URL`
   - Value: `postgresql://neondb_owner:npg_9VohXeW6nPIM@ep-cold-bar-agx5y4cp-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require`
   - Environment: Production, Preview, Development (виберіть всі)
6. Натисніть "Save"
7. Перезберіть проект (Redeploy)

## Після додавання:

1. Перейдіть в Deployments
2. Натисніть три крапки на останньому деплої
3. Виберіть "Redeploy"
4. Перевірте логи - має бути успішно


