/**
 * Перевірка підключення до бази (делегує verify-neon-connection).
 * Запуск: npm run db:check
 */
const { execSync } = require('child_process')
const path = require('path')
try {
  execSync('npx tsx scripts/verify-neon-connection.ts', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  })
} catch (e) {
  process.exit(e.status ?? 1)
}
