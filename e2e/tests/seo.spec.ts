import { test, expect } from '@playwright/test'
import { PATHS } from '../helpers/constants'

test.describe('SEO — meta та структура', () => {
  test('головна: title, description, keywords', async ({ page }) => {
    await page.goto(PATHS.home)
    await expect(page).toHaveTitle(/Xbase|запис|онлайн/i)
    const desc = await page.locator('meta[name="description"]').getAttribute('content')
    expect(desc).toBeTruthy()
    expect(desc!.length).toBeGreaterThan(20)
  })

  test('головна: Open Graph meta', async ({ page }) => {
    await page.goto(PATHS.home)
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
    const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content')
    expect(ogTitle).toBeTruthy()
    expect(ogDesc).toBeTruthy()
  })

  test('головна: robots index', async ({ page }) => {
    await page.goto(PATHS.home)
    const robots = await page.locator('meta[name="robots"]').getAttribute('content')
    expect(robots).toMatch(/index|follow/i)
  })

  test('головна: theme-color', async ({ page }) => {
    await page.goto(PATHS.home)
    const theme = await page.locator('meta[name="theme-color"]').getAttribute('content')
    expect(theme).toBeTruthy()
  })

  test('login: title', async ({ page }) => {
    await page.goto(PATHS.login)
    await expect(page).toHaveTitle(/вхід|login|Xbase/i)
  })

  test('register: title', async ({ page }) => {
    await page.goto(PATHS.register)
    await expect(page).toHaveTitle(/реєстрац|register|Xbase/i)
  })

  test('terms: title', async ({ page }) => {
    await page.goto(PATHS.terms)
    await expect(page).toHaveTitle(/умови|terms/i)
  })

  test('privacy: title', async ({ page }) => {
    await page.goto(PATHS.privacy)
    await expect(page).toHaveTitle(/політика|privacy/i)
  })

  test('головна: skip link для a11y', async ({ page }) => {
    await page.goto(PATHS.home)
    const skipLink = page.getByRole('link', { name: /перейти до основного|skip/i })
    await expect(skipLink).toBeVisible()
  })

  test('головна: JSON-LD schema', async ({ page }) => {
    await page.goto(PATHS.home)
    const jsonLd = page.locator('script[type="application/ld+json"]')
    await expect(jsonLd).toHaveCount(1)
  })
})
