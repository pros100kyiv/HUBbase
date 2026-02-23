# Резервна копія та відновлення

Перед міграцією (GitHub, Vercel) або великими змінами варто зробити backup бази та env-змінних.

## 1. Backup бази даних

```bash
npm run db:backup
```

Створює файл `backups/xbase-backup-YYYYMMDDHHMMSS.sql`.

**Потрібно:** `pg_dump` (PostgreSQL client tools). Якщо не встановлено:
- macOS: `brew install libpq && brew link --force libpq`
- Windows: [PostgreSQL Binaries](https://www.enterprisedb.com/download-postgresql-binaries)
- Linux: `sudo apt install postgresql-client`

**Альтернатива:** Neon Console → проект → Backup (automatic + point-in-time restore).

## 2. Backup env-змінних

Експортуй змінні з Vercel Dashboard:
- Project → Settings → Environment Variables → експортуй або збережи вручну у файл `.env.backup` (не коміть у git).

Критичні змінні:
- `DATABASE_URL` — Neon
- `DIRECT_URL` — для міграцій
- `NEXTAUTH_SECRET` / `JWT_SECRET`
- `META_*`, `TELEGRAM_*`, `VAPID_*` — інтеграції

## 3. Відновлення з SQL-дампу

```bash
# Встанови DATABASE_URL (нове або те саме підключення)
psql "$DATABASE_URL" -f backups/xbase-backup-YYYYMMDDHHMMSS.sql
```

Або на Windows (PowerShell):
```powershell
$env:PGPASSWORD = "your-password"
psql -h your-host.neon.tech -U user -d dbname -f backups\xbase-backup-YYYYMMDDHHMMSS.sql
```

Після відновлення:
```bash
npx prisma generate
npm run build
```

## 4. Швидкий чекліст перед міграцією

- [ ] `npm run db:backup` — збережено SQL-дамп
- [ ] Збережено env vars (Vercel export або копія вручну)
- [ ] Перевірено, що Neon проект не буде видалено
- [ ] Backup файл збережено в надійному місці (не тільки локально)
