import { test as base } from '@playwright/test'
import { PATHS, TEST } from '../helpers/constants'

/**
 * Фікстура для тестів з авторизованим користувачем.
 * Використовувати: test.extend(authFixture)
 */
export const authFixture = base.extend<{ authenticatedPage: ReturnType<typeof base['page']> }>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto(PATHS.testFlow)
    await page.getByRole('button', { name: /увійти автоматично/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 25_000 })
    await page.waitForLoadState('domcontentloaded')
    await use(page)
  },
})

/**
 * Простий логін через /test-flow.
 */
export async function quickLogin(page: import('@playwright/test').Page) {
  await page.goto(PATHS.testFlow)
  await page.getByRole('button', { name: /увійти автоматично/i }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
}
