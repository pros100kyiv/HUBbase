import { test, expect } from '@playwright/test'
import { PATHS, TEST } from '../helpers/constants'

test.describe('API — доступність', () => {
  test('GET /api/business/[slug] — 200 для валідного slug', async ({ request }) => {
    const res = await request.get(`${process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'}/api/business/${TEST.slug}`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data?.business).toBeTruthy()
  })

  test('GET /api/business/invalid-slug-xyz — 404', async ({ request }) => {
    const res = await request.get(`${process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'}/api/business/invalid-slug-xyz-123`)
    expect(res.status()).toBe(404)
  })

  test('GET /api/services — потрібен businessId', async ({ request }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
    const res = await request.get(`${base}/api/services?businessId=${TEST.slug}`)
    expect(res.status()).toBeLessThan(500)
  })

  test('POST /api/auth/login — 400 для порожнього body', async ({ request }) => {
    const res = await request.post(`${process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'}/api/auth/login`, {
      data: {},
    })
    expect(res.status()).toBe(400)
  })

  test('головна — завантажується без 5xx', async ({ page }) => {
    const res = await page.goto(PATHS.home)
    expect(res?.status()).toBeLessThan(500)
  })
})
