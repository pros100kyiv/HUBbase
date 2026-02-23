/**
 * Резервна копія PostgreSQL (Neon) бази даних.
 * Створює SQL-дамп у backups/xbase-backup-YYYYMMDD-HHMMSS.sql
 *
 * Потрібно: PostgreSQL client tools (pg_dump) — зазвичай є з Prisma/PostgreSQL.
 * Windows: встанови PostgreSQL або возьми pg_dump з ZIP: https://www.enterprisedb.com/download-postgresql-binaries
 *
 * Запуск: npm run db:backup
 */

import 'dotenv/config'
import { execSync } from 'child_process'
import { mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const BACKUPS_DIR = join(process.cwd(), 'backups')

function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('❌ DATABASE_URL не задано в .env')
    process.exit(1)
  }

  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
  const filename = `xbase-backup-${timestamp}.sql`
  const filepath = join(BACKUPS_DIR, filename)

  if (!existsSync(BACKUPS_DIR)) {
    mkdirSync(BACKUPS_DIR, { recursive: true })
    console.log('📁 Створено папку backups/')
  }

  console.log('💾 Створення резервної копії...')
  console.log('   Файл:', filepath)

  try {
    execSync('pg_dump', [url, '--no-owner', '--no-acl', '-F', 'p', '-f', filepath], {
      stdio: 'inherit',
      env: process.env,
    })
  } catch (e) {
    const msg = (e as Error & { stderr?: string }).message || ''
    if (msg.includes('pg_dump') || msg.includes('not found') || msg.includes('is not recognized')) {
      console.error('\n❌ pg_dump не знайдено.')
      console.error('\n   Встанови PostgreSQL client tools:')
      console.error('   - macOS (Homebrew): brew install libpq && brew link --force libpq')
      console.error('   - Windows: https://www.enterprisedb.com/download-postgresql-binaries')
      console.error('   - Linux: sudo apt install postgresql-client  або  sudo dnf install postgresql')
      console.error('\n   Або зроби backup через Neon Dashboard: Console → Backup')
      process.exit(1)
    }
    throw e
  }

  console.log('✅ Резервна копія збережена:', filepath)
  console.log('\n   Відновлення: psql "<DATABASE_URL>" -f', filename)
  console.log('   (або заміни DATABASE_URL на новий перед відновленням)')
}

main()
