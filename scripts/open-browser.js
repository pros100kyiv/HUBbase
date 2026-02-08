/**
 * Відкриває http://localhost:3000/login у браузері.
 * Запускати після "npm run dev" або разом з ним (в іншому терміналі).
 * Windows: start, macOS: open, Linux: xdg-open
 */
const { exec } = require('child_process')
const url = process.env.OPEN_URL || 'http://localhost:3000/login'
const isWin = process.platform === 'win32'
const cmd = isWin ? `start "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`
exec(cmd, (err) => { if (err) console.error('Не вдалося відкрити браузер:', err.message) })
