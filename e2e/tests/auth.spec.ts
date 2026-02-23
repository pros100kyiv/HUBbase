import { test, expect } from '@playwright/test'
import { PATHS, TEST } from '../helpers/constants'

test.describe('Auth — вхід та реєстрація', () => {
  test('форма входу відображається', async ({ page }) => {
    await page.goto(PATHS.login)
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/пароль/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Увійти', exact: true })).toBeVisible()
  })

  test('хедер: Вхід та Реєстрація', async ({ page }) => {
    await page.goto(PATHS.login)
    await expect(page.getByRole('button', { name: 'Вхід' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Реєстрація' })).toBeVisible()
  })

  test('логін з невалідними даними показує помилку', async ({ page }) => {
    await page.goto(PATHS.login)
    await page.getByLabel(/email/i).fill('invalid@test.com')
    await page.getByLabel(/пароль/i).fill('wrongpassword')
    await page.getByRole('button', { name: 'Увійти', exact: true }).click()
    await expect(
      page.getByText(/невірн|помилка|зареєстрова|error|спробуйте/i).first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('логін з валідним тестовим акаунтом', async ({ page }) => {
    await page.goto(PATHS.login)
    await page.getByLabel(/email/i).fill(TEST.email)
    await page.getByLabel(/пароль/i).fill(TEST.password)
    await page.getByRole('button', { name: 'Увійти', exact: true }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
    expect(page.url()).toContain('/dashboard')
  })

  test('редирект на логін при відвідуванні dashboard без сесії', async ({ page }) => {
    await page.goto(PATHS.dashboardMain)
    await page.waitForURL(/\/login/, { timeout: 10_000 })
  })

  test('швидкий вхід з /test-flow', async ({ page }) => {
    await page.goto(PATHS.testFlow)
    await expect(page.getByRole('heading', { name: /тестовий потік/i })).toBeVisible()
    await page.getByRole('button', { name: /увійти автоматично/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
  })

  test('реєстрація: форма відображається', async ({ page }) => {
    await page.goto(PATHS.register)
    await expect(page.getByLabel(/назва/i)).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/пароль/i).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Зареєструватися', exact: true })).toBeVisible()
  })

  test('посилання Вхід ↔ Реєстрація', async ({ page }) => {
    await page.goto(PATHS.login)
    await page.getByRole('button', { name: /зареєструватися/i }).click()
    await page.waitForURL(/\/register/)
    await page.getByRole('button', { name: /вхід/i }).first().click()
    await page.waitForURL(/\/login/)
  })

  test('dashboard main без сесії → login', async ({ page }) => {
    await page.goto(PATHS.dashboardMain)
    await page.waitForURL(/\/login/, { timeout: 10_000 })
  })

  test('dashboard analytics без сесії → login', async ({ page }) => {
    await page.goto(PATHS.dashboardAnalytics)
    await page.waitForURL(/\/login/, { timeout: 10_000 })
  })

  test('dashboard settings без сесії → login', async ({ page }) => {
    await page.goto(PATHS.dashboardSettings)
    await page.waitForURL(/\/login/, { timeout: 10_000 })
  })
})
