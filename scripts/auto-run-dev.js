#!/usr/bin/env node

/**
 * Автоматичний запуск dev сервера
 * Використання: node scripts/auto-run-dev.js
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Автоматичний запуск dev сервера...\n');

const devProcess = spawn('npm', ['run', 'dev'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  shell: true
});

devProcess.on('error', (error) => {
  console.error('❌ Помилка запуску:', error);
  process.exit(1);
});

devProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Процес завершився з кодом ${code}`);
    process.exit(code);
  }
});

// Обробка сигналів для коректного завершення
process.on('SIGINT', () => {
  console.log('\n🛑 Зупинка dev сервера...');
  devProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  devProcess.kill('SIGTERM');
  process.exit(0);
});

