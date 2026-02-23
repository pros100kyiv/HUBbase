import type { Page } from '@playwright/test'
import { PATHS } from '../helpers/constants'

export class HomePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(PATHS.home)
  }

  get loginLink() {
    return this.page.getByRole('link', { name: /вхід|увійти/i }).first()
  }

  get registerLink() {
    return this.page.getByRole('link', { name: /реєстрац|зареєструвати/i }).first()
  }

  get mainHeading() {
    return this.page.getByRole('heading', { level: 1 })
  }

  get skipLink() {
    return this.page.getByRole('link', { name: /перейти до основного|skip/i })
  }
}
