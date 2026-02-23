import { test, expect } from '@playwright/test'
import { PATHS } from '../helpers/constants'

test.describe('Навігація — посилання та редиректи', () => {
  test('головна: footer — Privacy, Terms, Data deletion', async ({ page }) => {
    await page.goto(PATHS.home)
    await page.getByRole('link', { name: /політика|privacy/i }).first().click()
    await expect(page).toHaveURL(/\/privacy/)
  })

  test('головна: footer → Terms', async ({ page }) => {
    await page.goto(PATHS.home)
    await page.getByRole('link', { name: /умови|terms/i }).first().click()
    await expect(page).toHaveURL(/\/terms/)
  })

  test('головна: footer → Data deletion', async ({ page }) => {
    await page.goto(PATHS.home)
    await page.getByRole('link', { name: /видалення даних|data/i }).first().click()
    await expect(page).toHaveURL(/\/data-deletion/)
  })

  test('privacy: посилання на data-deletion', async ({ page }) => {
    await page.goto(PATHS.privacy)
    await page.getByRole('link', { name: /видалення даних|facebook|instagram/i }).first().click()
    await expect(page).toHaveURL(/\/data-deletion/)
  })

  test('terms: посилання На головну', async ({ page }) => {
    await page.goto(PATHS.terms)
    await page.getByRole('link', { name: /на головну/i }).click()
    await expect(page).toHaveURL('/')
  })

  test('privacy: посилання На головну', async ({ page }) => {
    await page.goto(PATHS.privacy)
    await page.getByRole('link', { name: /на головну/i }).click()
    await expect(page).toHaveURL('/')
  })

  test('login: Забули пароль → forgot-password', async ({ page }) => {
    await page.goto(PATHS.login)
    await page.getByRole('button', { name: /забули пароль/i }).click()
    await expect(page).toHaveURL(/\/forgot-password/)
  })

  test('forgot-password: Повернутися до входу', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.getByRole('button', { name: /повернутися до входу/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('test-flow: Головна → home', async ({ page }) => {
    await page.goto(PATHS.testFlow)
    await page.getByRole('button', { name: /головна/i }).first().click()
    await expect(page).toHaveURL('/')
  })
})
