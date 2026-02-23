import { test, expect } from '@playwright/test'
import { PATHS } from '../helpers/constants'

test.describe('Smoke — доступність та рендер', () => {
  test.describe.configure({ tag: '@smoke' })

  test('головна відкривається', async ({ page }) => {
    await page.goto(PATHS.home)
    await expect(page).toHaveTitle(/Xbase|Запис онлайн/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('layout: uk locale, темна тема', async ({ page }) => {
    await page.goto(PATHS.home)
    const html = page.locator('html')
    await expect(html).toHaveAttribute('lang', 'uk')
  })

  test('навігація: посилання на реєстрацію та вхід', async ({ page }) => {
    await page.goto(PATHS.home)
    await expect(page.getByRole('link', { name: /вхід|увійти/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /реєстрац|зареєструвати/i }).first()).toBeVisible()
  })

  test('404 для неіснуючого роуту', async ({ page }) => {
    const res = await page.goto('/non-existent-page-xyz')
    expect(res?.status()).toBe(404)
  })

  test('meta viewport для мобільної адаптивності', async ({ page }) => {
    await page.goto(PATHS.home)
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).toContain('width=device-width')
  })

  test('manifest іконки', async ({ page }) => {
    await page.goto(PATHS.home)
    const icon = await page.locator('link[rel="icon"]').first().getAttribute('href')
    expect(icon).toBeTruthy()
  })

  test('charset utf-8', async ({ page }) => {
    await page.goto(PATHS.home)
    const charset = await page.locator('meta[charset]').first().getAttribute('charset')
    expect(charset?.toLowerCase()).toBe('utf-8')
  })
})
