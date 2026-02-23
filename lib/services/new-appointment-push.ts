/**
 * Надсилання push-сповіщень власнику бізнесу при створенні нового запису.
 */
import { prisma } from '@/lib/prisma'
import { sendWebPush, isVapidConfigured } from '@/lib/services/web-push'
import { formatInTimeZone } from 'date-fns-tz'
import { uk } from 'date-fns/locale'
import { parseBookingTimeZone } from '@/lib/utils/booking-settings'

export async function sendNewAppointmentPush(
  businessId: string,
  appointmentId: string,
  businessSlug: string | null,
  businessName: string | null,
  clientName: string,
  startTime: Date
): Promise<void> {
  if (!isVapidConfigured()) return

  const [business, master] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { settings: true, name: true, slug: true },
    }),
    prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { master: { select: { name: true } } },
    }),
  ])

  const timeZone = parseBookingTimeZone(business?.settings ?? null)
  const dateStr = formatInTimeZone(startTime, timeZone, 'd MMMM, HH:mm', { locale: uk })
  const masterName = master?.master?.name ?? 'Спеціаліст'
  const bizName = businessName ?? business?.name ?? 'Бізнес'
  const body = `Новий запис: ${clientName} → ${masterName}, ${dateStr}`

  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://xbase.online')).replace(/\/$/, '')
  const pushUrl = `${baseUrl}/dashboard/appointments?status=Pending`

  const subs = await prisma.businessStaffPushSubscription.findMany({
    where: { businessId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })

  const deadIds: string[] = []
  for (const sub of subs) {
    try {
      const result = await sendWebPush(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        {
          title: `📅 Новий запис: ${bizName}`,
          body,
          url: pushUrl,
          icon: `${baseUrl}/icon.png`,
          badge: `${baseUrl}/icon.png`,
          tag: `new-apt-${appointmentId}`,
          vibrate: [200, 100, 200, 100, 200],
        }
      )
      if (!result.ok && result.dead) deadIds.push(sub.id)
    } catch {
      // continue with other subs
    }
  }

  if (deadIds.length > 0) {
    await prisma.businessStaffPushSubscription.deleteMany({ where: { id: { in: deadIds } } }).catch(() => {})
  }
}
