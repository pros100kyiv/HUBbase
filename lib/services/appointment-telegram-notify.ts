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

type NotifyType = 'confirmed' | 'rescheduled' | 'cancelled' | 'change_request_rejected'

export interface NotifyExtra {
  newStartTime?: Date
  newEndTime?: Date
  /** Коментар від бізнесу */
  businessNote?: string
  rejectedRequestType?: string
}

export async function sendAppointmentNotificationToTelegram(
  businessId: string,
  appointmentId: string,
  type: NotifyType,
  extra?: NotifyExtra
): Promise<{ sent: boolean; error?: string }> {
  try {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, businessId },
      include: {
        master: { select: { name: true } },
        client: { select: { id: true, telegramChatId: true } },
        business: { select: { name: true, telegramBotToken: true, settings: true, telegramSettings: true } },
      },
    })

    if (!appointment || !appointment.business?.telegramBotToken) return { sent: false }

    const ts = appointment.business.telegramSettings
    let telegramSettings: Record<string, unknown> = {}
    try {
      if (ts) telegramSettings = JSON.parse(ts) as Record<string, unknown>
    } catch {}
    const notifyOnConfirm = telegramSettings.notifyOnAppointmentConfirm !== false
    const notifyOnReject = telegramSettings.notifyOnAppointmentReject !== false
    const notifyOnChangeReqReject = telegramSettings.notifyOnChangeRequestReject !== false
    if (type === 'confirmed' && !notifyOnConfirm) return { sent: false }
    if (type === 'cancelled' && !notifyOnReject) return { sent: false }
    if (type === 'change_request_rejected' && !notifyOnChangeReqReject) return { sent: false }

    const chatId =
      appointment.client?.telegramChatId?.trim() || appointment.telegramChatId?.trim() || ''
    if (!chatId) return { sent: false }
    const masterName = appointment.master?.name ?? 'Спеціаліст'
    const businessName = appointment.business.name ?? 'Салон'
    const timeZone = parseBookingTimeZone(appointment.business.settings)

    let text = ''
    const noteBlock = extra?.businessNote?.trim()
      ? `\n\n💬 <i>${extra.businessNote.replace(/</g, '&lt;')}</i>`
      : ''

    if (type === 'confirmed') {
      const dt = new Date(appointment.startTime)
      const dateStr = formatInTimeZone(dt, timeZone, 'd MMMM, HH:mm', { locale: uk })
      text =
        `✅ <b>Запис підтверджено!</b>\n\n` +
        `${businessName}\n` +
        `Спеціаліст: ${masterName}\n` +
        `Дата та час: ${dateStr}\n\n` +
        `Чекаємо на вас!` +
        noteBlock +
        `\n\nПеренести або скасувати можна лише після підтвердження майстра в кабінеті.`
    } else if (type === 'rescheduled' && extra?.newStartTime && extra?.newEndTime) {
      const dt = new Date(extra.newStartTime)
      const dateStr = formatInTimeZone(dt, timeZone, 'd MMMM, HH:mm', { locale: uk })
      text =
        `🔄 <b>Запис перенесено</b>\n\n` +
        `${businessName}\n` +
        `Спеціаліст: ${masterName}\n` +
        `Новий час: ${dateStr}\n\n` +
        `Чекаємо на вас!` +
        noteBlock +
        `\n\nЩоб скасувати або змінити час — лише після підтвердження майстра в кабінеті.`
    } else if (type === 'cancelled') {
      text =
        `❌ <b>Запис скасовано</b>\n\n` +
        `${businessName}\n` +
        `Запис до ${masterName} скасовано.` +
        noteBlock +
        `\n\nМожете записатися знову — напишіть /book`
    } else if (type === 'change_request_rejected') {
      const reqLabel = extra?.rejectedRequestType === 'CANCEL' ? 'скасування' : extra?.rejectedRequestType === 'RESCHEDULE' ? 'перенесення' : 'запиту'
      text =
        `❌ <b>Запит відхилено</b>\n\n` +
        `${businessName}\n` +
        `Ваш запит на ${reqLabel} не прийнято.` +
        noteBlock +
        `\n\nМожете записатися знову — напишіть /book`
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
