import type { Page } from '@playwright/test'
import { PATHS } from '../helpers/constants'

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(PATHS.login)
  }

  get email() {
    return this.page.getByLabel(/email/i)
  }

  get password() {
    return this.page.getByLabel(/пароль/i)
  }

  get submitButton() {
    return this.page.getByRole('button', { name: 'Увійти', exact: true })
  }

  get registerLink() {
    return this.page.getByRole('button', { name: /зареєструватися/i })
  }

  get forgotPasswordLink() {
    return this.page.getByRole('button', { name: /забули пароль/i })
  }

  async login(email: string, password: string) {
    await this.email.fill(email)
    await this.password.fill(password)
    await this.submitButton.click()
  }

  async expectFormVisible() {
    await this.email.waitFor({ state: 'visible' })
    await this.password.waitFor({ state: 'visible' })
    await this.submitButton.waitFor({ state: 'visible' })
  }
}
