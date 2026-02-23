import type { Page } from '@playwright/test'
import { PATHS, TEST } from '../helpers/constants'

export class BookingPage {
  constructor(private page: Page) {}

  async goto(slug: string = TEST.slug) {
    await this.page.goto(PATHS.booking(slug))
    await this.page.waitForLoadState('domcontentloaded')
  }

  get recordOnlineButton() {
    return this.page.getByRole('button', { name: /запис онлайн/i })
  }

  get homeButton() {
    return this.page.getByRole('button', { name: /головна/i })
  }

  async clickRecordOnline() {
    await this.recordOnlineButton.click()
  }

  async expectOnMasterStep() {
    const body = (await this.page.locator('body').textContent() ?? '').toLowerCase()
    return (
      body.includes('спеціаліст') ||
      body.includes('майстер') ||
      body.includes('оберіть') ||
      body.includes('виберіть')
    )
  }
}
