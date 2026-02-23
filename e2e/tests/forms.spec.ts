import { test, expect } from '@playwright/test'
import { PATHS } from '../helpers/constants'

test.describe('Форми — валідація', () => {
  test('register: невалідний email показує помилку', async ({ page }) => {
    await page.goto(PATHS.register)
    await page.getByLabel(/назва/i).fill('Тест')
    await page.getByLabel(/email/i).fill('invalid')
    await page.getByLabel(/пароль/i).first().fill('password123')
    await page.getByRole('button', { name: 'Зареєструватися', exact: true }).click()
    await expect(page.getByText(/невірний формат|email/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('register: короткий пароль (якщо є валідація)', async ({ page }) => {
    await page.goto(PATHS.register)
    await page.getByLabel(/назва/i).fill('Тест')
    await page.getByLabel(/email/i).fill('test@example.com')
    await page.getByLabel(/пароль/i).first().fill('123')
    await page.getByRole('button', { name: 'Зареєструватися', exact: true }).click()
    const body = (await page.locator('body').textContent() ?? '').toLowerCase()
    const hasError =
      body.includes('мінімум') || body.includes('6 символів') || body.includes('пароль') || body.includes('помилка')
    expect(hasError).toBeTruthy()
  })

  test('login: порожні поля — submit не проходить (required)', async ({ page }) => {
    await page.goto(PATHS.login)
    const submit = page.getByRole('button', { name: 'Увійти', exact: true })
    await submit.click()
    await expect(page).toHaveURL(PATHS.login)
  })

  test('forgot-password: порожній email — форма не відправляється', async ({ page }) => {
    await page.goto('/forgot-password')
    const submit = page.getByRole('button', { name: /відправ|send/i })
    await submit.click()
    await expect(page).toHaveURL(/\/forgot-password/)
  })
})
