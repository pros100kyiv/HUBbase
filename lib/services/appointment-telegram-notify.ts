/**
 * Надсилання сповіщень клієнту про записи через Telegram
 */
import { prisma } from '@/lib/prisma'
import { Telegraf } from 'telegraf'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'

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
        client: { select: { telegramChatId: true } },
        business: { select: { name: true, telegramBotToken: true } },
      },
    })

    if (!appointment || !appointment.client?.telegramChatId || !appointment.business?.telegramBotToken) {
      return { sent: false }
    }

    const chatId = appointment.client.telegramChatId
    const masterName = appointment.master?.name ?? 'Спеціаліст'
    const businessName = appointment.business.name ?? 'Салон'

    let text = ''
    if (type === 'confirmed') {
      const dt = new Date(appointment.startTime)
      text =
        `✅ <b>Запис підтверджено!</b>\n\n` +
        `${businessName}\n` +
        `Спеціаліст: ${masterName}\n` +
        `Дата та час: ${format(dt, 'd MMMM, HH:mm', { locale: uk })}\n\n` +
        `Чекаємо на вас!\n\n` +
        `Перенести або скасувати можна лише після підтвердження майстра в кабінеті. Посилання для керування — у підтвердженні запису.`
    } else if (type === 'rescheduled' && extra?.newStartTime && extra?.newEndTime) {
      const dt = new Date(extra.newStartTime)
      text =
        `🔄 <b>Запис перенесено</b>\n\n` +
        `${businessName}\n` +
        `Спеціаліст: ${masterName}\n` +
        `Новий час: ${format(dt, 'd MMMM, HH:mm', { locale: uk })}\n\n` +
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
