import { test, expect } from '@playwright/test'
import { PATHS, TEST } from '../helpers/constants'

test.describe('Сторінки — вміст і відображення', () => {
  test('головна: блок з фічами', async ({ page }) => {
    await page.goto(PATHS.home)
    await expect(page.getByText(/записи та календар|онлайн бронювання/i).first()).toBeVisible()
  })

  test('terms: умови використання', async ({ page }) => {
    await page.goto(PATHS.terms)
    await expect(page).toHaveTitle(/умови|терміни|terms/i)
    await expect(page.getByRole('heading', { name: /умови використання/i })).toBeVisible()
  })

  test('privacy: політика конфіденційності', async ({ page }) => {
    await page.goto(PATHS.privacy)
    await expect(page).toHaveTitle(/політика|конфіденцій|privacy/i)
  })

  test('test-flow: покроковий тест', async ({ page }) => {
    await page.goto(PATHS.testFlow)
    await expect(page.getByRole('heading', { name: /швидкий вхід/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /бронювання \(тест\)/i })).toBeVisible()
  })

  test('forgot-password: сторінка відкривається', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByText(/введіть email|відновлення паролю/i).first()).toBeVisible()
  })

  test('booking: сторінка бронювання за slug', async ({ page }) => {
    await page.goto(PATHS.booking(TEST.slug))
    await page.waitForLoadState('networkidle')
    const body = await page.locator('body').textContent()
    const hasContent = body?.includes('Xbase') || body?.includes('Запис') || body?.includes('дата') || body?.includes('Далі')
    expect(hasContent).toBeTruthy()
  })

  test('qr: QR сторінка за slug', async ({ page }) => {
    await page.goto(PATHS.qr(TEST.slug))
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /qr код/i })).toBeVisible({ timeout: 5000 })
  })

  test('data-deletion: сторінка видалення даних', async ({ page }) => {
    await page.goto(PATHS.dataDeletion)
    await expect(page.getByRole('heading', { name: /видалення даних|facebook|instagram/i }).first()).toBeVisible()
  })

  test('reset-password: форма (без токену показує помилку)', async ({ page }) => {
    await page.goto(PATHS.resetPassword)
    await expect(page.getByText(/токен|відновлення/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('admin login: форма входу', async ({ page }) => {
    await page.goto(PATHS.adminLogin)
    await expect(page.getByRole('heading', { name: /центр управління/i })).toBeVisible()
    await expect(page.getByPlaceholder(/developer@xbase/i)).toBeVisible()
  })

  test('test-login: сторінка тесту логіну', async ({ page }) => {
    await page.goto('/test-login')
    await expect(page.getByRole('heading', { name: /тест логіну/i })).toBeVisible()
  })

  test('auth/telegram: сторінка відкривається', async ({ page }) => {
    await page.goto(PATHS.authTelegram)
    await page.waitForLoadState('domcontentloaded')
    const body = (await page.locator('body').textContent() ?? '').toLowerCase()
    const hasContent = body.includes('telegram') || body.includes('вхід') || body.includes('увійти')
    expect(hasContent).toBeTruthy()
  })

  test('qr без slug: редірект або контент', async ({ page }) => {
    const res = await page.goto(PATHS.qrBase)
    expect(res?.status()).toBeLessThan(500)
  })
})
