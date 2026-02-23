/**
 * Cron: надсилання нагадувань про візит за reminderHoursBefore годин до запису
 * Викликати: GET /api/cron/send-appointment-reminders
 * (Vercel Cron або зовнішній scheduler — кожну годину)
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addHours } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { uk } from 'date-fns/locale'
import { Telegraf } from 'telegraf'
import { SMSService } from '@/lib/services/sms-service'
import { EmailService } from '@/lib/services/email-service'
import { sendWebPush, isVapidConfigured } from '@/lib/services/web-push'
import { parseBookingTimeZone } from '@/lib/utils/booking-settings'

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET

function getReminderHoursBefore(settingsRaw: string | null | undefined): number {
  if (!settingsRaw || typeof settingsRaw !== 'string') return 24
  try {
    const parsed = JSON.parse(settingsRaw) as { reminderHoursBefore?: number }
    const h = Number(parsed?.reminderHoursBefore)
    return Number.isFinite(h) && h > 0 ? Math.min(168, Math.round(h)) : 24
  } catch {
    return 24
  }
}

function getReminderPushEnabled(settingsRaw: string | null | undefined): boolean {
  if (!settingsRaw || typeof settingsRaw !== 'string') return true
  try {
    const parsed = JSON.parse(settingsRaw) as { reminderPushEnabled?: boolean }
    return parsed?.reminderPushEnabled !== false
  } catch {
    return true
  }
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization')
    const expected = `Bearer ${CRON_SECRET}`
    if (authHeader !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()
  const results: { businessId: string; sent: number; failed: number; errors: string[] }[] = []

  try {
    const businesses = await prisma.business.findMany({
      where: { remindersEnabled: true },
      select: {
        id: true,
        name: true,
        slug: true,
        settings: true,
        reminderSmsEnabled: true,
        reminderEmailEnabled: true,
        reminderTelegramEnabled: true,
        telegramBotToken: true,
        smsProvider: true,
        smsApiKey: true,
        smsSender: true,
        emailProvider: true,
        emailApiKey: true,
        emailFrom: true,
        emailFromName: true,
      },
    })

    for (const biz of businesses) {
      const hoursBefore = getReminderHoursBefore(biz.settings)
      // Слот нагадування: startTime в [now, now + hoursBefore] — час надсилати
      const windowEnd = addHours(now, hoursBefore)

      const appointments = await prisma.appointment.findMany({
        where: {
          businessId: biz.id,
          reminderSent: false,
          status: { notIn: ['Cancelled', 'Скасовано'] },
          startTime: { gt: now, lte: windowEnd },
        },
        include: {
          master: { select: { name: true } },
          client: { select: { phone: true, email: true, telegramChatId: true } },
        },
      })

      let sent = 0
      let failed = 0
      const errors: string[] = []

      const timeZone = parseBookingTimeZone(biz.settings)

      for (const apt of appointments) {
        const masterName = apt.master?.name ?? 'Спеціаліст'
        const startDate = new Date(apt.startTime)
        const dateStr = formatInTimeZone(startDate, timeZone, 'd MMMM, HH:mm', { locale: uk })
        const msgText = `Нагадування: ${biz.name}. Запис до ${masterName} — ${dateStr}. Чекаємо на вас!`
        let aptSent = false

        if (biz.reminderSmsEnabled && biz.smsProvider && biz.smsApiKey && apt.client?.phone) {
          try {
            const sms = new SMSService(biz.smsProvider, biz.smsApiKey, biz.smsSender || 'Xbase')
            const r = await sms.send(apt.client.phone, msgText)
            if (r.success) {
              sent++
              aptSent = true
              await prisma.reminderLog.create({
                data: { businessId: biz.id, appointmentId: apt.id, channel: 'SMS', status: 'SENT', triggeredBy: 'cron' },
              })
            } else {
              failed++
              errors.push(`SMS ${apt.id}: failed`)
            }
          } catch (e) {
            failed++
            errors.push(`SMS ${apt.id}: ${e instanceof Error ? e.message : String(e)}`)
          }
        }

        if (biz.reminderEmailEnabled && biz.emailProvider && biz.emailApiKey && apt.client?.email) {
          try {
            const email = new EmailService(
              biz.emailProvider,
              biz.emailApiKey,
              biz.emailFrom || 'noreply@xbase.online',
              biz.emailFromName || biz.name
            )
            const r = await email.send(
              apt.client.email,
              `Нагадування: ${biz.name}`,
              `<p>${msgText}</p>`
            )
            if (r.success) {
              sent++
              aptSent = true
              await prisma.reminderLog.create({
                data: { businessId: biz.id, appointmentId: apt.id, channel: 'EMAIL', status: 'SENT', triggeredBy: 'cron' },
              })
            } else {
              failed++
              errors.push(`Email ${apt.id}: failed`)
            }
          } catch (e) {
            failed++
            errors.push(`Email ${apt.id}: ${e instanceof Error ? e.message : String(e)}`)
          }
        }

        const tgChatId = apt.client?.telegramChatId?.trim() || (apt as { telegramChatId?: string | null }).telegramChatId?.trim() || ''
        if (biz.reminderTelegramEnabled && biz.telegramBotToken && tgChatId) {
          try {
            const bot = new Telegraf(biz.telegramBotToken)
            const tgMsg = `⏰ ${msgText}\n\n` +
              `Перенести або скасувати запис можна лише після підтвердження в кабінеті. Посилання для керування — у підтвердженні запису.`
            await bot.telegram.sendMessage(tgChatId, tgMsg, { parse_mode: 'HTML' })
            sent++
            aptSent = true
            await prisma.reminderLog.create({
              data: { businessId: biz.id, appointmentId: apt.id, channel: 'TELEGRAM', status: 'SENT', triggeredBy: 'cron' },
            })
          } catch (e) {
            failed++
            errors.push(`TG ${apt.id}: ${e instanceof Error ? e.message : String(e)}`)
          }
        }

        if (isVapidConfigured() && getReminderPushEnabled(biz.settings)) {
          const pushSubs = await prisma.pushSubscription.findMany({
            where: { businessId: biz.id, appointmentId: apt.id },
            select: { id: true, endpoint: true, p256dh: true, auth: true },
          })
          if (pushSubs.length > 0) {
            const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://xbase.online')).replace(/\/$/, '')
            const pushUrl = biz.slug ? `${baseUrl}/booking/${biz.slug}` : baseUrl
            const deadIds: string[] = []
            let pushSent = 0
            for (const sub of pushSubs) {
              try {
                const result = await sendWebPush(
                  { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                  {
                    title: biz.name ? `Нагадування: ${biz.name}` : 'Нагадування',
                    body: msgText,
                    url: pushUrl,
                    icon: `${baseUrl}/icon.png`,
                    badge: `${baseUrl}/icon.png`,
                    tag: `reminder-${apt.id}`,
                    vibrate: [200, 100, 200],
                  }
                )
                if (result.ok) {
                  pushSent++
                  sent++
                  aptSent = true
                } else if (result.dead) deadIds.push(sub.id)
              } catch (e) {
                errors.push(`Push ${apt.id}: ${e instanceof Error ? e.message : String(e)}`)
              }
            }
            await prisma.reminderLog.create({
              data: {
                businessId: biz.id,
                appointmentId: apt.id,
                channel: 'PUSH',
                status: pushSent > 0 ? 'SENT' : 'FAILED',
                triggeredBy: 'cron',
                error: pushSent === 0 && pushSubs.length > 0 ? 'All subscriptions failed or expired' : null,
              },
            })
            if (deadIds.length > 0) {
              await prisma.pushSubscription.deleteMany({ where: { id: { in: deadIds } } }).catch(() => {})
            }
          }
        }

        if (aptSent) {
          await prisma.appointment.update({
            where: { id: apt.id },
            data: { reminderSent: true },
          })
        }
      }

      results.push({ businessId: biz.id, sent, failed, errors: errors.slice(0, 5) })
    }

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    console.error('Cron send-appointment-reminders error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
