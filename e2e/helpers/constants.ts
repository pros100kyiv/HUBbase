/**
 * Константи для E2E: тестовий бізнес, URL, селектори.
 */

export const TEST = {
  email: process.env.E2E_TEST_EMAIL || 'admin@045barbershop.com',
  password: process.env.E2E_TEST_PASSWORD || 'password123',
  slug: process.env.E2E_TEST_SLUG || '045-barbershop',
} as const

export const PATHS = {
  home: '/',
  login: '/login',
  register: '/register',
  testFlow: '/test-flow',
  testLogin: '/test-login',
  booking: (slug: string) => `/booking/${slug}`,
  qr: (slug: string) => `/qr/${slug}`,
  dashboard: '/dashboard',
  dashboardMain: '/dashboard/main',
  dashboardAppointments: '/dashboard/appointments',
  dashboardClients: '/dashboard/clients',
  dashboardMasters: '/dashboard/masters',
  dashboardSchedule: '/dashboard/schedule',
  dashboardSettings: '/dashboard/settings',
  dashboardPrice: '/dashboard/price',
  dashboardAnalytics: '/dashboard/analytics',
  dashboardSocial: '/dashboard/social',
  dashboardSubscription: '/dashboard/subscription',
  authTelegram: '/auth/telegram',
  qrBase: '/qr',
  terms: '/terms',
  privacy: '/privacy',
  dataDeletion: '/data-deletion',
  resetPassword: '/reset-password',
  adminLogin: '/admin/login',
  adminControl: '/admin/control-center',
} as const
