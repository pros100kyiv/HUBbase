/**
 * Quick smoke test for navigation destinations.
 *
 * Usage:
 *   npx tsx scripts/smoke-routes.ts
 *   BASE_URL=http://127.0.0.1:3000 npx tsx scripts/smoke-routes.ts
 */
const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '')

type Check = { path: string; expect?: number[]; name?: string }

const checks: Check[] = [
  { path: '/', name: 'Landing' },
  { path: '/login', name: 'Login' },
  { path: '/register', name: 'Register' },

  // Dashboard routes that buttons/menu navigate to.
  { path: '/dashboard', name: 'Dashboard root (redirect to main on client)' },
  { path: '/dashboard/main', name: 'Dashboard main' },
  { path: '/dashboard/appointments', name: 'Dashboard appointments' },
  { path: '/dashboard/price', name: 'Dashboard price' },
  { path: '/dashboard/clients', name: 'Dashboard clients' },
  { path: '/dashboard/schedule', name: 'Dashboard schedule' },
  { path: '/dashboard/social', name: 'Dashboard social' },
  { path: '/dashboard/analytics', name: 'Dashboard analytics' },
  { path: '/dashboard/subscription', name: 'Dashboard subscription' },
  { path: '/dashboard/settings', name: 'Dashboard settings' },

  // Public booking / QR destinations used by buttons.
  { path: '/booking/045-barbershop', name: 'Public booking' },
  { path: '/qr/045-barbershop', name: 'QR booking page' },
]

async function fetchStatus(url: string): Promise<{ status: number; contentType: string | null }> {
  const res = await fetch(url, {
    redirect: 'manual',
    headers: {
      // Avoid any caching during smoke test.
      'Cache-Control': 'no-store',
    },
  })
  const contentType = res.headers.get('content-type')
  return { status: res.status, contentType }
}

async function main() {
  console.log(`BASE_URL: ${BASE_URL}`)
  let failed = 0

  for (const c of checks) {
    const url = `${BASE_URL}${c.path}`
    const { status, contentType } = await fetchStatus(url).catch((e) => {
      failed++
      console.log(`✗ ${c.path} -> fetch failed: ${String(e)}`)
      return { status: -1, contentType: null }
    })
    const expect = c.expect ?? [200, 301, 302, 307, 308]
    const ok = expect.includes(status)
    if (!ok) failed++
    console.log(`${ok ? '✓' : '✗'} ${c.path} -> ${status} ${contentType ? `(${contentType})` : ''}${c.name ? ` — ${c.name}` : ''}`)
  }

  if (failed > 0) {
    console.log(`\nFAILED: ${failed}`)
    process.exit(1)
  }
  console.log('\nOK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

export {}

