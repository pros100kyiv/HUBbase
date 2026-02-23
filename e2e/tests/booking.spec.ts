import { test, expect } from '@playwright/test'
import { PATHS, TEST } from '../helpers/constants'

test.describe('Бронювання — покроковий флоу', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATHS.booking(TEST.slug))
    await page.waitForLoadState('domcontentloaded')
  })

  test('відкривається сторінка бронювання', async ({ page }) => {
    await expect(page).toHaveURL(new RegExp(`/booking/${TEST.slug}`))
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test('є елементи вибору (дата, час, послуги)', async ({ page }) => {
    await expect(page.getByRole('button', { name: /запис онлайн|далі|продовжити/i })).toBeVisible({ timeout: 8000 })
    const body = await page.locator('body').textContent()
    const hasBookingUI =
      body?.includes('дата') ||
      body?.includes('Дата') ||
      body?.includes('Далі') ||
      body?.includes('час') ||
      body?.includes('Час') ||
      body?.includes('календар') ||
      body?.includes('виберіть')
    expect(hasBookingUI).toBeTruthy()
  })

  test('кнопка Далі/Назад або аналог є', async ({ page }) => {
    const nextBtn = page.getByRole('button', { name: /далі|next|продовжити/i })
    const backBtn = page.getByRole('button', { name: /назад|back/i })
    await expect(nextBtn.or(backBtn)).toBeVisible({ timeout: 5000 })
  })

  test('немає критичних помилок у консолі', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      const type = msg.type()
      const text = msg.text()
      if (type === 'error' && !text.includes('favicon') && !text.includes('404')) {
        errors.push(text)
      }
    })
    await expect(page.getByRole('button', { name: /запис онлайн|далі|продовжити/i })).toBeVisible({ timeout: 8000 })
    expect(errors.filter((e) => e.includes('ResizeObserver') === false)).toHaveLength(0)
  })

  test('кнопка Головна веде на /', async ({ page }) => {
    await expect(page.getByRole('button', { name: /головна|запис онлайн|далі/i }).first()).toBeVisible({ timeout: 8000 })
    const homeBtn = page.getByRole('button', { name: /головна/i })
    if ((await homeBtn.count()) > 0) {
      await homeBtn.first().click()
      await expect(page).toHaveURL('/')
    }
  })

  test('перехід з landing на крок вибору спеціаліста', async ({ page }) => {
    const recordBtn = page.getByRole('button', { name: /запис онлайн/i })
    await expect(recordBtn).toBeVisible({ timeout: 8000 })
    await recordBtn.click()
    await expect(page.getByText(/спеціаліст|майстер|оберіть|виберіть/i).first()).toBeVisible({ timeout: 8000 })
    const body = (await page.locator('body').textContent() ?? '').toLowerCase()
    const onMasterStep =
      body.includes('спеціаліст') ||
      body.includes('майстер') ||
      body.includes('оберіть') ||
      body.includes('виберіть')
    expect(onMasterStep).toBeTruthy()
  })
})
