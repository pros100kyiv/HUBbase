import type { FullConfig } from '@playwright/test'

async function globalSetup(_config: FullConfig) {
  // Перевірка наявності тестового бізнесу через API (опціонально)
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
  const slug = process.env.E2E_TEST_SLUG || '045-barbershop'
  try {
    const res = await fetch(`${base}/api/business/${slug}`)
    if (!res.ok && res.status === 404) {
      console.warn(`[E2E] Тестовий бізнес ${slug} не знайдено. Деякі тести можуть падати.`)
    }
  } catch {
    // Сервер ще не готовий — нормально на початку
  }
}

export default globalSetup
