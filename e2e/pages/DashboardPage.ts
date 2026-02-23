import type { Page } from '@playwright/test'
import { PATHS } from '../helpers/constants'

export class DashboardPage {
  constructor(private page: Page) {}

  async goto(path: string = PATHS.dashboardMain) {
    await this.page.goto(path)
    await this.page.waitForLoadState('domcontentloaded')
  }

  async gotoAppointments() {
    await this.goto(PATHS.dashboardAppointments)
  }

  async gotoClients() {
    await this.goto(PATHS.dashboardClients)
  }

  async gotoSettings() {
    await this.goto(PATHS.dashboardSettings)
  }

  async gotoAnalytics() {
    await this.goto(PATHS.dashboardAnalytics)
  }

  async expectOnDashboard() {
    await this.page.waitForURL(/\/dashboard/, { timeout: 15_000 })
  }

  async expectNavigationVisible() {
    const body = (await this.page.locator('body').textContent() ?? '').toLowerCase()
    const hasNav =
      body.includes('записи') ||
      body.includes('клієнти') ||
      body.includes('налаштування') ||
      body.includes('сьогодні')
    return hasNav
  }
}
