import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PATHS } from '../helpers/constants'

test.describe('Accessibility — axe-core аудит', () => {
  test('головна: без критичних порушень a11y', async ({ page }) => {
    await page.goto(PATHS.home)
    const results = await new AxeBuilder({ page }).analyze()
    const critical = results.violations.filter((v) => v.impact === 'critical')
    expect(critical, `Критичні порушення a11y: ${JSON.stringify(critical, null, 2)}`).toHaveLength(0)
  })

  test('login: без критичних порушень a11y', async ({ page }) => {
    await page.goto(PATHS.login)
    await page.waitForLoadState('domcontentloaded')
    const results = await new AxeBuilder({ page }).analyze()
    const critical = results.violations.filter((v) => v.impact === 'critical')
    expect(critical, `Критичні порушення a11y: ${JSON.stringify(critical, null, 2)}`).toHaveLength(0)
  })

  test('register: без критичних порушень a11y', async ({ page }) => {
    await page.goto(PATHS.register)
    const results = await new AxeBuilder({ page }).analyze()
    const critical = results.violations.filter((v) => v.impact === 'critical')
    expect(critical).toHaveLength(0)
  })
})
