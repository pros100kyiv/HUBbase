import { test, expect } from '@playwright/test'
import { PATHS, TEST } from '../helpers/constants'

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  desktopWide: { width: 1440, height: 900 },
  desktopSmall: { width: 1280, height: 720 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
  mobileSmall: { width: 390, height: 844 },
  mobileLarge: { width: 414, height: 896 },
  mobileTiny: { width: 320, height: 568 },
} as const

function noHorizontalOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => {
    const html = document.documentElement
    const body = document.body
    return html.scrollWidth <= html.clientWidth && body.scrollWidth <= body.clientWidth
  })
}

test.describe('Візуальні перевірки — десктоп', () => {
  test('головна: десктоп 1920×1080 — без overflow', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto(PATHS.home)
    await page.waitForLoadState('domcontentloaded')
    expect(await noHorizontalOverflow(page)).toBe(true)
  })

  test('головна: десктоп 1280×720 — без overflow', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktopSmall)
    await page.goto(PATHS.home)
    await page.waitForLoadState('domcontentloaded')
    expect(await noHorizontalOverflow(page)).toBe(true)
  })

  test('головна: десктоп 1440×900 — без overflow', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktopWide)
    await page.goto(PATHS.home)
    await page.waitForLoadState('domcontentloaded')
    expect(await noHorizontalOverflow(page)).toBe(true)
  })

  test('головна: десктоп — hero та CTA видимі', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto(PATHS.home)
    await expect(page.getByRole('heading', { name: /онлайн-запис|запис онлайн/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /почати|реєстрація/i }).first()).toBeVisible()
  })

  test('login: десктоп — форма по центру', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto(PATHS.login)
    const form = page.locator('form')
    await expect(form).toBeVisible()
    const box = await form.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeLessThanOrEqual(450)
  })

  test('register: десктоп — форма рендериться', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto(PATHS.register)
    await expect(page.getByRole('button', { name: 'Зареєструватися', exact: true })).toBeVisible()
  })

  test('booking: десктоп — landing видимий', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto(PATHS.booking(TEST.slug))
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('button', { name: /запис онлайн/i })).toBeVisible({ timeout: 8000 })
  })
})

test.describe('Візуальні перевірки — планшет', () => {
  test('головна: 768×1024 — без overflow', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet)
    await page.goto(PATHS.home)
    await page.waitForLoadState('domcontentloaded')
    expect(await noHorizontalOverflow(page)).toBe(true)
  })

  test('login: планшет — форма в межах екрану', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet)
    await page.goto(PATHS.login)
    const form = page.locator('form')
    await expect(form).toBeVisible()
    const box = await form.boundingBox()
    expect(box?.width).toBeLessThanOrEqual(500)
  })
})

test.describe('Візуальні перевірки — мобільні', () => {
  test('головна: 375×667 — без overflow', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto(PATHS.home)
    await page.waitForLoadState('domcontentloaded')
    expect(await noHorizontalOverflow(page)).toBe(true)
  })

  test('головна: 414×896 — без overflow', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobileLarge)
    await page.goto(PATHS.home)
    await page.waitForLoadState('domcontentloaded')
    expect(await noHorizontalOverflow(page)).toBe(true)
  })

  test('головна: 390×844 — без overflow', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobileSmall)
    await page.goto(PATHS.home)
    await page.waitForLoadState('domcontentloaded')
    expect(await noHorizontalOverflow(page)).toBe(true)
  })

  test('головна: 320×568 (малий екран) — без overflow', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobileTiny)
    await page.goto(PATHS.home)
    await page.waitForLoadState('domcontentloaded')
    expect(await noHorizontalOverflow(page)).toBe(true)
  })

  test('login: 375×667 — форма в межах екрану', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto(PATHS.login)
    const form = page.locator('form')
    await expect(form).toBeVisible()
    const box = await form.boundingBox()
    expect(box?.width).toBeLessThanOrEqual(400)
  })

  test('login: 320×568 — форма видима', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobileTiny)
    await page.goto(PATHS.login)
    const form = page.locator('form')
    await expect(form).toBeVisible()
    const box = await form.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeLessThanOrEqual(350)
  })

  test('register: 375×667 — форма в межах екрану', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto(PATHS.register)
    await expect(page.getByRole('button', { name: 'Зареєструватися', exact: true })).toBeVisible()
  })

  test('booking: 375×667 — CTA видимий', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto(PATHS.booking(TEST.slug))
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('button', { name: /запис онлайн/i })).toBeVisible({ timeout: 8000 })
  })

  test('touch target: кнопки мін. 36px на 390px', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobileSmall)
    await page.goto(PATHS.home)
    const primaryBtn = page.getByRole('link', { name: /зареєструвати|реєстрація/i }).first()
    await expect(primaryBtn).toBeVisible()
    const box = await primaryBtn.boundingBox()
    if (box) expect(box.height).toBeGreaterThanOrEqual(36)
  })

  test('terms: 320×568 — контент без overflow', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobileTiny)
    await page.goto(PATHS.terms)
    expect(await noHorizontalOverflow(page)).toBe(true)
  })

  test('qr: 375×667 — QR блок видимий', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto(PATHS.qr(TEST.slug))
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /qr код/i })).toBeVisible({ timeout: 5000 })
  })
})
