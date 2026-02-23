import { test, expect } from '@playwright/test'
import { authFixture } from '../fixtures/auth.fixture'
import { PATHS } from '../helpers/constants'

authFixture.describe('Dashboard — після входу', () => {
  authFixture('редирект на dashboard/main після логіну', async ({ authenticatedPage: page }) => {
    expect(page.url()).toMatch(/\/dashboard/)
  })

  authFixture('навігація: видимі посилання на розділи', async ({ authenticatedPage: page }) => {
    await page.goto(PATHS.dashboardMain)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('link', { name: /записи|клієнти|налаштування|розклад|прайс/i })).toBeVisible({ timeout: 8000 })
    const body = (await page.locator('body').textContent() ?? '').toLowerCase()
    const hasNav =
      body.includes('записи') ||
      body.includes('клієнти') ||
      body.includes('майстри') ||
      body.includes('розклад') ||
      body.includes('налаштування') ||
      body.includes('прайс') ||
      body.includes('сьогодні')
    expect(hasNav).toBeTruthy()
  })

  authFixture('розділ appointments відкривається', async ({ authenticatedPage: page }) => {
    await page.goto(PATHS.dashboardAppointments)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/\/dashboard\/appointments/)
  })

  authFixture('розділ masters відкривається', async ({ authenticatedPage: page }) => {
    await page.goto(PATHS.dashboardMasters)
    await page.waitForLoadState('domcontentloaded')
    // masters редіректить на schedule
    await expect(page).toHaveURL(/\/dashboard\/(masters|schedule)/)
  })

  authFixture('розділ clients відкривається', async ({ authenticatedPage: page }) => {
    await page.goto(PATHS.dashboardClients)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/\/dashboard\/clients/)
  })

  authFixture('розділ settings відкривається', async ({ authenticatedPage: page }) => {
    await page.goto(PATHS.dashboardSettings)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/\/dashboard\/settings/)
  })

  authFixture('розділ analytics відкривається', async ({ authenticatedPage: page }) => {
    await page.goto(PATHS.dashboardAnalytics)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/\/dashboard\/analytics/)
  })

  authFixture('розділ social відкривається', async ({ authenticatedPage: page }) => {
    await page.goto(PATHS.dashboardSocial)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/\/dashboard\/social/)
  })

  authFixture('розділ price відкривається', async ({ authenticatedPage: page }) => {
    await page.goto(PATHS.dashboardPrice)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/\/dashboard\/price/)
  })

  authFixture('розділ schedule відкривається', async ({ authenticatedPage: page }) => {
    await page.goto(PATHS.dashboardSchedule)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/\/dashboard\/schedule/)
  })

  authFixture('розділ subscription відкривається', async ({ authenticatedPage: page }) => {
    await page.goto(PATHS.dashboardSubscription)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/\/dashboard\/subscription/)
  })
})

test.describe('Dashboard — без авторизації', () => {
  test('main без сесії → login', async ({ page }) => {
    await page.goto(PATHS.dashboardMain)
    await page.waitForURL(/\/login/, { timeout: 10_000 })
  })
})
