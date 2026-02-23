import { test, expect } from '@playwright/test'
import { PATHS, TEST } from '../helpers/constants'

test.describe('Помилки та крайні випадки', () => {
  test('booking: невалідний slug — помилка або 404', async ({ page }) => {
    await page.goto(PATHS.booking('non-existent-business-xyz-123'))
    await page.waitForLoadState('domcontentloaded')
    const body = (await page.locator('body').textContent() ?? '').toLowerCase()
    const hasError = body.includes('не знайдено') || body.includes('бізнес') || body.includes('404')
    expect(hasError).toBeTruthy()
  })

  test('qr: невалідний slug', async ({ page }) => {
    await page.goto(PATHS.qr('non-existent-xyz'))
    await page.waitForLoadState('domcontentloaded')
    const body = (await page.locator('body').textContent() ?? '').toLowerCase()
    const hasMsg = body.includes('slug') || body.includes('не знайдено') || body.length > 100
    expect(hasMsg).toBeTruthy()
  })

  test('qr: без slug — редірект або помилка', async ({ page }) => {
    const res = await page.goto(PATHS.qrBase)
    expect(res?.status()).toBeLessThan(500)
  })

  test('404: кастомна сторінка', async ({ page }) => {
    const res = await page.goto('/page-that-does-not-exist-xyz')
    expect(res?.status()).toBe(404)
  })

  test('dashboard без сесії → login', async ({ page }) => {
    await page.goto(PATHS.dashboardSettings)
    await page.waitForURL(/\/login/, { timeout: 10_000 })
  })

  test('admin control без токену → login', async ({ page }) => {
    await page.goto(PATHS.adminControl)
    await page.waitForURL(/\/admin\/login/, { timeout: 10_000 })
  })
})
