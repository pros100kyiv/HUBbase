/**
 * Комплексна перевірка всіх вкладок та візуальних елементів.
 * Забезпечує стабільність та коректність роботи застосунку.
 */
import { test, expect } from '@playwright/test'
import { authFixture } from '../fixtures/auth.fixture'
import { PATHS, TEST } from '../helpers/constants'

function noHorizontalOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => {
    const html = document.documentElement
    const body = document.body
    return html.scrollWidth <= html.clientWidth && body.scrollWidth <= body.clientWidth
  })
}

test.describe('Комплексна перевірка — головна та публічні сторінки', () => {
  test('головна: hero, CTA, footer, блоки фічей', async ({ page }) => {
    await page.goto(PATHS.home)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: /реєстрац|зареєструвати/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /вхід|увійти/i }).first()).toBeVisible()
    await expect(page.getByRole('contentinfo').or(page.locator('footer'))).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk')
    expect(await noHorizontalOverflow(page)).toBe(true)
  })

  test('login: форма, labels, кнопки', async ({ page }) => {
    await page.goto(PATHS.login)
    await page.waitForLoadState('domcontentloaded')
    const form = page.locator('[data-testid="login-form"]')
    await expect(form).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('textbox', { name: /email|електронна/i })).toBeVisible()
    await expect(page.getByTestId('login-submit')).toBeVisible()
    await expect(page.getByRole('button', { name: /забули пароль/i })).toBeVisible()
    expect(await noHorizontalOverflow(page)).toBe(true)
  })

  test('register: форма, поля, кнопка', async ({ page }) => {
    await page.goto(PATHS.register)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('button', { name: 'Зареєструватися', exact: true })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /email|пошта/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Увійти', exact: true })).toBeVisible()
    expect(await noHorizontalOverflow(page)).toBe(true)
  })

  test('terms: заголовок, контент, на головну', async ({ page }) => {
    await page.goto(PATHS.terms)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /умови використання|умов/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /головн|на головну/i })).toBeVisible()
    expect(await noHorizontalOverflow(page)).toBe(true)
  })

  test('privacy: заголовок, контент', async ({ page }) => {
    await page.goto(PATHS.privacy)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /політика конфіденційності|конфіденційності/i })).toBeVisible()
  })
})

test.describe('Комплексна перевірка — бронювання', () => {
  test('booking landing: картка бізнесу, CTA запис онлайн', async ({ page }) => {
    await page.goto(PATHS.booking(TEST.slug))
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('button', { name: /запис онлайн/i })).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: /головна/i })).toBeVisible()
    expect(await noHorizontalOverflow(page)).toBe(true)
  })

  test('booking: перехід на майстра, назад', async ({ page }) => {
    await page.goto(PATHS.booking(TEST.slug))
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('button', { name: /запис онлайн/i })).toBeVisible({ timeout: 8000 })
    await page.getByRole('button', { name: /запис онлайн/i }).click()
    await expect(page.getByText(/спеціаліст|майстер|оберіть/i).first()).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: /назад/i })).toBeVisible()
  })
})

test.describe('Комплексна перевірка — Dashboard (усі вкладки + візуальні елементи)', () => {
  const DASHBOARD_ROUTES = [
    { path: PATHS.dashboardMain, check: /сьогодні|записи|календар/i },
    { path: PATHS.dashboardAppointments, check: /записи|календар|appointments/i },
    { path: PATHS.dashboardClients, check: /клієнти|clients/i },
    // /dashboard/masters редіректить на /dashboard/schedule
    { path: PATHS.dashboardMasters, check: /майстри|спеціаліст|розклад|schedule/i, urlPattern: /\/dashboard\/(masters|schedule)/ },
    { path: PATHS.dashboardSchedule, check: /розклад|schedule/i },
    { path: PATHS.dashboardPrice, check: /прайс|послуги|price/i },
    { path: PATHS.dashboardAnalytics, check: /аналітик|analytics/i },
    { path: PATHS.dashboardSocial, check: /соцмереж|telegram|social/i },
    { path: PATHS.dashboardSettings, check: /налаштування|settings/i },
    { path: PATHS.dashboardSubscription, check: /підписк|subscription/i },
  ]

  for (const route of DASHBOARD_ROUTES) {
    const { path, check, urlPattern } = route
    const name = path.split('/').pop() || 'main'
    const urlRegex = urlPattern || new RegExp(path.replace('/', '\\/'))
    authFixture(`${name}: URL, контент, без overflow`, async ({ authenticatedPage: page }) => {
      await page.goto(route.path, { timeout: 45_000, waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('domcontentloaded')
      await expect(page).toHaveURL(urlRegex)
      const body = (await page.locator('body').textContent() ?? '').toLowerCase()
      expect(body).toMatch(check)
      expect(await noHorizontalOverflow(page)).toBe(true)
    })
  }
})

test.describe('Комплексна перевірка — QR', () => {
  test('qr сторінка: заголовок, QR-блок', async ({ page }) => {
    await page.goto(PATHS.qr(TEST.slug))
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /qr код/i })).toBeVisible({ timeout: 5000 })
    expect(await noHorizontalOverflow(page)).toBe(true)
  })
})

test.describe('Комплексна перевірка — відсутність критичних помилок', () => {
  test('головна: без JS-помилок у консолі', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      const t = msg.type()
      const text = msg.text()
      if (t === 'error' && !text.includes('favicon') && !text.includes('404')) {
        errors.push(text)
      }
    })
    await page.goto(PATHS.home)
    await page.waitForLoadState('networkidle').catch(() => null)
    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0)
  })

  test('login: без JS-помилок', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) errors.push(msg.text())
    })
    await page.goto(PATHS.login)
    await page.waitForLoadState('domcontentloaded')
    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0)
  })

  test('dashboard main: без JS-помилок', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) errors.push(msg.text())
    })
    await page.goto(PATHS.login)
    await page.getByRole('textbox', { name: /email|електронна/i }).fill(TEST.email)
    await page.getByLabel(/пароль/i).fill(TEST.password)
    await page.getByTestId('login-submit').click()
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
    await page.goto(PATHS.dashboardMain)
    await page.waitForLoadState('domcontentloaded')
    // ResizeObserver, Failed to fetch, loadNotes — можливі в тестовому середовищі
    const ignore = ['ResizeObserver', 'Failed to fetch', 'Error loading notes']
    expect(errors.filter((e) => !ignore.some((k) => e.includes(k)))).toHaveLength(0)
  })
})
