import { test, expect } from '@playwright/test'
import { PATHS } from '../helpers/constants'

test.describe('Доступність (a11y)', () => {
  test('головна: основні landmarks', async ({ page }) => {
    await page.goto(PATHS.home)
    const main = page.getByRole('main')
    await expect(main).toBeVisible()
  })

  test('login: форма має labels', async ({ page }) => {
    await page.goto(PATHS.login)
    const email = page.getByLabel(/email/i)
    const password = page.getByLabel(/пароль/i)
    await expect(email).toBeVisible()
    await expect(password).toBeVisible()
  })

  test('login: кнопка submit має текст', async ({ page }) => {
    await page.goto(PATHS.login)
    const submit = page.getByRole('button', { name: 'Увійти', exact: true })
    await expect(submit).toBeVisible()
    await expect(submit).toHaveAttribute('type', 'submit')
  })

  test('головна: зображення мають alt або роль', async ({ page }) => {
    await page.goto(PATHS.home)
    const images = page.locator('img')
    const count = await images.count()
    for (let i = 0; i < Math.min(count, 5); i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')
      expect(alt !== null).toBeTruthy()
    }
  })

  test('головна: фокусовані елементи мають outline', async ({ page }) => {
    await page.goto(PATHS.home)
    const link = page.getByRole('link', { name: /вхід/i }).first()
    await link.focus()
    const outline = await link.evaluate((el) => {
      const s = getComputedStyle(el)
      return s.outlineWidth !== '0px' || s.boxShadow !== 'none'
    })
    expect(outline).toBeTruthy()
  })

  test('login: input має autocomplete', async ({ page }) => {
    await page.goto(PATHS.login)
    const email = page.getByLabel(/email/i)
    await expect(email).toHaveAttribute('autocomplete', 'email')
  })

  test('register: required поля позначені', async ({ page }) => {
    await page.goto(PATHS.register)
    const nameInput = page.getByLabel(/назва/i)
    await expect(nameInput).toHaveAttribute('required', '')
  })
})
