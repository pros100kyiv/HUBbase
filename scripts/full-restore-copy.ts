/**
 * Повна копія для відновлення — зберігає в D:\Xbase\xbase-restore-YYYYMMDD-HHMMSS
 *
 * Включає:
 * - Код проєкту (без node_modules, .next)
 * - Git історію
 * - SQL-дамп БД (якщо pg_dump доступний)
 * - Prisma schema та міграції
 * - Шаблон env та інструкції відновлення
 *
 * Запуск: npm run restore:copy
 */

import 'dotenv/config'
import { execSync } from 'child_process'
import { cpSync, mkdirSync, existsSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const TARGET_BASE = 'D:\\Xbase'
const EXCLUDE = ['node_modules', '.next', '.turbo', 'backups', 'playwright-report', 'test-results', '.vercel', 'dist']

function main() {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
  const backupName = `xbase-restore-${timestamp}`
  const targetDir = join(TARGET_BASE, backupName)
  const projectRoot = process.cwd()

  console.log('📦 Створення повної копії для відновлення...')
  console.log('   Шлях:', targetDir)

  if (!existsSync(TARGET_BASE)) {
    mkdirSync(TARGET_BASE, { recursive: true })
    console.log('   📁 Створено', TARGET_BASE)
  }
  mkdirSync(targetDir, { recursive: true })

  const SKIP_FILES = ['.env', '.env.local', '.env.development.local', '.env.production.local', '.env.test.local']

  function shouldExclude(name: string): boolean {
    if (EXCLUDE.includes(name)) return true
    if (SKIP_FILES.includes(name)) return true
    return false
  }

  function copyDir(src: string, dest: string) {
    const entries = readdirSync(src, { withFileTypes: true })
    for (const e of entries) {
      if (shouldExclude(e.name)) continue
      if (shouldExclude(e.name)) continue
      const s = join(src, e.name)
      const d = join(dest, e.name)
      if (e.isDirectory()) {
        mkdirSync(d, { recursive: true })
        copyDir(s, d)
      } else {
        cpSync(s, d)
      }
    }
  }

  console.log('\n1️⃣  Копіювання коду...')
  copyDir(projectRoot, targetDir)

  if (existsSync(join(projectRoot, '.git'))) {
    console.log('   (включено .git)')
  }

  console.log('\n2️⃣  SQL-дамп бази даних...')
  const url = process.env.DATABASE_URL
  const sqlPath = join(targetDir, 'database-backup.sql')
  if (url) {
    try {
      execSync('pg_dump', [url, '--no-owner', '--no-acl', '-F', 'p', '-f', sqlPath], {
        stdio: 'pipe',
        env: process.env,
      })
      console.log('   ✅ database-backup.sql збережено')
    } catch (e) {
      const msg = (e as Error).message || ''
      if (msg.includes('pg_dump') || msg.includes('not found') || msg.includes('is not recognized')) {
        writeFileSync(
          join(targetDir, '00-DATABASE-BACKUP-ПОТРІБЕН.txt'),
          `pg_dump не встановлено. Зроби backup БД одним із способів:
1) Встанови PostgreSQL: https://www.enterprisedb.com/download-postgresql-binaries
   Потім: npm run db:backup
2) Neon Console → проект → Backup (automatic + point-in-time restore)

DATABASE_URL з .env — збережи окремо (секрет).`
        )
        console.log('   ⚠️ pg_dump не знайдено. Інструкції в 00-DATABASE-BACKUP-ПОТРІБЕН.txt')
      } else {
        throw e
      }
    }
  } else {
    writeFileSync(join(targetDir, '00-DATABASE-BACKUP-ПОТРІБЕН.txt'), 'DATABASE_URL не задано в .env. Додай і запусти npm run db:backup.')
    console.log('   ⚠️ DATABASE_URL не задано')
  }

  console.log('\n3️⃣  Шаблон env та інструкції...')
  const envTemplate = `# Скопіюй у .env і заповни значення (з Vercel або збережених даних)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
NEXT_PUBLIC_BASE_URL="https://xbase.online"
# JWT, META, TELEGRAM, VAPID — з Vercel Project → Settings → Environment Variables
`
  writeFileSync(join(targetDir, 'env-template.txt'), envTemplate)

  const restoreReadme = `# Відновлення Xbase з копії

## 1. Встанови залежності
\`\`\`bash
cd "${backupName}"
npm install
\`\`\`

## 2. База даних
- Якщо є **database-backup.sql**:
  \`\`\`bash
  # Встанови DATABASE_URL у .env
  psql "%DATABASE_URL%" -f database-backup.sql
  \`\`\`
- Якщо немає — встанови pg_dump, отримай дамп з Neon, або використай Neon point-in-time restore.

## 3. Env-змінні
\`\`\`bash
copy env-template.txt .env
# Заповни .env значеннями з Vercel / збережених даних
\`\`\`

## 4. Prisma і запуск
\`\`\`bash
npx prisma generate
npm run build
npm run start
\`\`\`

## Дата копії
${new Date().toISOString()}
`
  writeFileSync(join(targetDir, 'RESTORE_README.md'), restoreReadme)

  console.log('\n✅ Повна копія готова:', targetDir)
  console.log('\n   Вміст: код, .git, database-backup.sql (або інструкція), env-template.txt, RESTORE_README.md')
}

main()
