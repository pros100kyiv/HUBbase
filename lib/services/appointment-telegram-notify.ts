/**
 * Надсилання сповіщень про записи через Telegram.
 * Важливо: відправляється ТІЛЬКИ конкретному клієнту запису (appointment.client.telegramChatId),
 * ніколи не розсилається всім клієнтам.
 */
import { prisma } from '@/lib/prisma'
import { Telegraf } from 'telegraf'
import { formatInTimeZone } from 'date-fns-tz'
import { uk } from 'date-fns/locale'
import { parseBookingTimeZone } from '@/lib/utils/booking-settings'

type NotifyType = 'confirmed' | 'rescheduled' | 'cancelled'

export async function sendAppointmentNotificationToTelegram(
  businessId: string,
  appointmentId: string,
  type: NotifyType,
  extra?: { newStartTime?: Date; newEndTime?: Date }
): Promise<{ sent: boolean; error?: string }> {
  try {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, businessId },
      include: {
        master: { select: { name: true } },
        client: { select: { id: true, telegramChatId: true } },
        business: { select: { name: true, telegramBotToken: true, settings: true } },
      },
    })

    // Сповіщення ТІЛЬКИ клієнту цього запису — ніколи не розсилати всім
    if (!appointment || !appointment.clientId || !appointment.client?.telegramChatId?.trim() || !appointment.business?.telegramBotToken) {
      return { sent: false }
    }

    const chatId = appointment.client.telegramChatId.trim()
    const masterName = appointment.master?.name ?? 'Спеціаліст'
    const businessName = appointment.business.name ?? 'Салон'
    const timeZone = parseBookingTimeZone(appointment.business.settings)

    let text = ''
    if (type === 'confirmed') {
      const dt = new Date(appointment.startTime)
      const dateStr = formatInTimeZone(dt, timeZone, 'd MMMM, HH:mm', { locale: uk })
      text =
        `✅ <b>Запис підтверджено!</b>\n\n` +
        `${businessName}\n` +
        `Спеціаліст: ${masterName}\n` +
        `Дата та час: ${dateStr}\n\n` +
        `Чекаємо на вас!\n\n` +
        `Перенести або скасувати можна лише після підтвердження майстра в кабінеті. Посилання для керування — у підтвердженні запису.`
    } else if (type === 'rescheduled' && extra?.newStartTime && extra?.newEndTime) {
      const dt = new Date(extra.newStartTime)
      const dateStr = formatInTimeZone(dt, timeZone, 'd MMMM, HH:mm', { locale: uk })
      text =
        `🔄 <b>Запис перенесено</b>\n\n` +
        `${businessName}\n` +
        `Спеціаліст: ${masterName}\n` +
        `Новий час: ${dateStr}\n\n` +
        `Чекаємо на вас!\n\n` +
        `Щоб скасувати або змінити час — лише після підтвердження майстра в кабінеті.`
    } else if (type === 'cancelled') {
      text =
        `❌ <b>Запис скасовано</b>\n\n` +
        `${businessName}\n` +
        `Запис до ${masterName} скасовано.\n\n` +
        `Можете записатися знову — напишіть /book`
    } else {
      return { sent: false }
    }

    const bot = new Telegraf(appointment.business.telegramBotToken)
    await bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' })
    return { sent: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Appointment Telegram notify error:', msg)
    return { sent: false, error: msg }
  }
}
