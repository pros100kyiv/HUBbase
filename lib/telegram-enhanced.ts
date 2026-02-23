import { Telegraf, Context, Markup } from 'telegraf'
import { format, parseISO } from 'date-fns'
import { uk } from 'date-fns/locale'
import { formatInTimeZone } from 'date-fns-tz'
import { prisma } from './prisma'
import { parseBookingSlotsOptions } from './utils/booking-settings'
import { formatWorkingHoursSummary } from './utils/working-hours-display'
import { hashAppointmentAccessToken } from './utils/appointment-access-token'

interface TelegramBotConfig {
  token: string
  businessId: string
}

interface TelegramBotMessageSettings {
  welcomeMessage?: string
  newUserMessage?: string
  autoReplyMessage?: string
  bookingEnabled?: boolean
  bookingServiceMode?: 'both' | 'pricelist_only' | 'simple_only'
  /** true = повідомлення приймаються тільки після натискання кнопки «Написати повідомлення» */
  messagesOnlyViaButton?: boolean
  /** Сповіщення клієнту в Telegram при підтвердженні/відхиленні запису */
  notifyOnAppointmentConfirm?: boolean
  notifyOnAppointmentReject?: boolean
  notifyOnChangeRequestReject?: boolean
  /** Показувати модалку з полем коментаря при підтвердженні/відхиленні */
  promptCommentOnConfirm?: boolean
  promptCommentOnReject?: boolean
  /** Кнопка «Мої записи» — показувати майбутні візити клієнта */
  myAppointmentsEnabled?: boolean
  /** Кнопка «Інформація про бізнес» */
  infoButtonEnabled?: boolean
  /** В інфо: кнопка «Прокласти маршрут» (Google Maps) */
  infoRouteButtonEnabled?: boolean
  /** В інфо: кнопка «Зателефонувати» */
  infoCallButtonEnabled?: boolean
  /** В інфо: кнопка «Записатися онлайн» */
  infoBookingButtonEnabled?: boolean
}

interface BookingState {
  step: 'master' | 'service_choice' | 'service' | 'slot' | 'slot_date' | 'slot_time' | 'contact'
  masterId?: string
  masterName?: string
  /** З прайсу */
  serviceId?: string
  serviceName?: string
  serviceDuration?: number
  servicePrice?: number
  /** Без послуги */
  withoutService?: boolean
  selectedDate?: string
  slot?: string
  slotLabel?: string
  durationMinutes?: number
}

const bookingSession = new Map<string, BookingState>()
/** Чат в «режимі введення повідомлення» — після кнопки «Написати повідомлення» */
const awaitingMessageSession = new Map<string, number>()
const SESSION_TTL_MIN = 30

async function getBookingState(sessionKey: string): Promise<BookingState | undefined> {
  const mem = bookingSession.get(sessionKey)
  if (mem) return mem
  const row = await prisma.telegramBookingSession.findUnique({ where: { sessionKey } })
  if (!row || row.expiresAt < new Date()) {
    if (row) await prisma.telegramBookingSession.delete({ where: { sessionKey } }).catch(() => {})
    return undefined
  }
  try {
    const state = JSON.parse(row.state) as BookingState
    bookingSession.set(sessionKey, state)
    return state
  } catch {
    return undefined
  }
}

async function setBookingState(sessionKey: string, state: BookingState): Promise<void> {
  bookingSession.set(sessionKey, state)
  const expiresAt = new Date(Date.now() + SESSION_TTL_MIN * 60 * 1000)
  await prisma.telegramBookingSession.upsert({
    where: { sessionKey },
    create: { sessionKey, state: JSON.stringify(state), expiresAt },
    update: { state: JSON.stringify(state), expiresAt },
  })
}

async function deleteBookingState(sessionKey: string): Promise<void> {
  bookingSession.delete(sessionKey)
  await prisma.telegramBookingSession.delete({ where: { sessionKey } }).catch(() => {})
}

const DEFAULT_WELCOME = '✅ Вітаємо, {{name}}!\n\nВаша роль: {{role}}\n\nВи отримуватимете сповіщення про нові записи та нагадування.\n\nОберіть дію:'
const DEFAULT_NEW_USER = '👋 Вітаємо!\n\nТут ви можете:\n• 📅 Записатися до спеціаліста\n• ℹ️ Дізнатися адресу, графік, телефон\n• 📋 Переглянути свої записи\n• ✉️ Написати нам\n\nОберіть дію нижче 👇'
const DEFAULT_AUTO_REPLY = '✅ Дякуємо! Ваше повідомлення отримано. Ми відповімо найближчим часом.'

async function getBotSettings(businessId: string): Promise<TelegramBotMessageSettings> {
  const defaults: TelegramBotMessageSettings = {
    bookingEnabled: true, // за замовчуванням запис через Telegram увімкнено
    notifyOnAppointmentConfirm: true,
    notifyOnAppointmentReject: true,
    notifyOnChangeRequestReject: true,
  }
  try {
    const b = await prisma.business.findUnique({
      where: { id: businessId },
      select: { telegramSettings: true },
    })
    if (b?.telegramSettings) {
      const parsed = JSON.parse(b.telegramSettings) as TelegramBotMessageSettings
      return { ...defaults, ...parsed }
    }
  } catch {}
  return defaults
}

/** В одному вікні: редагує повідомлення (при callback) або відповідає (при команді/тексті) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function editOrReply(ctx: Context, text: string, extra?: Record<string, any>) {
  const msg = ctx.callbackQuery && 'message' in ctx.callbackQuery ? ctx.callbackQuery.message : null
  const opts = { parse_mode: 'HTML' as const, ...extra }
  if (msg && 'text' in msg) {
    try {
      await ctx.editMessageText(text, opts)
      return
    } catch {
      /* message too long / not modified - fallback to reply */
    }
  }
  await ctx.reply(text, opts)
}

/**
 * Створює розширеного Telegram бота з повним функціоналом
 */
export function createEnhancedTelegramBot(config: TelegramBotConfig) {
  const bot = new Telegraf(config.token)

  // Логування дій
  const logAction = async (action: string, command: string | null, message: string | null, telegramUserId?: string) => {
    try {
      await prisma.telegramLog.create({
        data: {
          businessId: config.businessId,
          telegramUserId: telegramUserId || null,
          action,
          command,
          message,
        },
      })
    } catch (error) {
      console.error('Error logging Telegram action:', error)
    }
  }

  // Отримуємо користувача з контексту
  const getUser = async (ctx: Context) => {
    const telegramId = BigInt(ctx.from?.id || 0)
    return await prisma.telegramUser.findUnique({
      where: { telegramId },
      include: { business: true },
    })
  }

  // Перевірка прав доступу (бот використовує тільки create_broadcast для нагадувань)
  const hasPermission = (role: string, permission: string): boolean => {
    const permissions: Record<string, string[]> = {
      DEVELOPER: ['*'],
      OWNER: ['create_broadcast'],
      ADMIN: ['create_broadcast'],
      MANAGER: ['create_broadcast'],
      EMPLOYEE: [],
      CLIENT: ['receive_broadcast'],
      VIEWER: [],
    }
    const rolePermissions = permissions[role] || []
    return rolePermissions.includes('*') || rolePermissions.includes(permission)
  }

  // Клавіатура для клієнтів та нових користувачів
  const getWriteMessageKeyboard = (settings: TelegramBotMessageSettings) => {
    const bookingEnabled = !!settings.bookingEnabled
    const showInfo = settings.infoButtonEnabled !== false
    const showMyAppointments = settings.myAppointmentsEnabled !== false
    const buttons: any[] = []
    if (showInfo) buttons.push([Markup.button.callback('ℹ️ Інформація про бізнес', 'menu_info')])
    if (bookingEnabled) buttons.push([Markup.button.callback('📅 Записатися до спеціаліста', 'book_start')])
    if (showMyAppointments) buttons.push([Markup.button.callback('📋 Мої записи', 'menu_my_appointments')])
    buttons.push([Markup.button.callback('✉️ Написати повідомлення', 'menu_write_message')])
    return Markup.inlineKeyboard(buttons)
  }

  // Головне меню для співробітників
  const getMainMenu = (role: string, settings?: TelegramBotMessageSettings) => {
    const showInfo = settings?.infoButtonEnabled !== false
    const buttons: any[] = []
    if (hasPermission(role, 'create_broadcast')) {
      buttons.push([Markup.button.callback('⏰ Створити нагадування', 'menu_reminder_create')])
      buttons.push([Markup.button.callback('📝 Мої нагадування', 'menu_reminders')])
    }
    if (showInfo) buttons.push([Markup.button.callback('ℹ️ Інформація про бізнес', 'menu_info')])
    buttons.push([Markup.button.callback('✉️ Написати повідомлення', 'menu_write_message')])
    buttons.push([Markup.button.callback('ℹ️ Допомога', 'menu_help')])
    return Markup.inlineKeyboard(buttons)
  }

  // Команда /start (в т.ч. deep link після зовнішнього запису: ?start=booked_<token>)
  bot.command('start', async (ctx: Context) => {
    try {
      const telegramId = BigInt(ctx.from?.id || 0)
      const msgText = (ctx.message && 'text' in ctx.message ? ctx.message.text : '') || ''
      const payload = msgText.replace(/^\/start\s*/i, '').trim()

      await logAction('command', 'start', payload || null, ctx.from?.id?.toString())

      // Прихід після зовнішнього запису — показати підтвердження
      if (payload.startsWith('booked_')) {
        const token = payload.slice(7).trim()
        if (token.length >= 20) {
          try {
            const tokenHash = hashAppointmentAccessToken(token)
            const access = await prisma.appointmentAccessToken.findFirst({
              where: { tokenHash, businessId: config.businessId, revokedAt: null },
              select: {
                appointment: {
                  select: {
                    id: true,
                    clientName: true,
                    startTime: true,
                    endTime: true,
                    status: true,
                    customServiceName: true,
                    master: { select: { name: true } },
                    business: { select: { name: true, slug: true } },
                  },
                },
              },
            })
            if (access?.appointment) {
              const apt = access.appointment
              const tz = 'Europe/Kyiv'
              const startDate = new Date(apt.startTime)
              const endDate = new Date(apt.endTime)
              const dayStr = formatInTimeZone(startDate, tz, 'd MMMM yyyy', { locale: uk })
              const timeStr = `${formatInTimeZone(startDate, tz, 'HH:mm', { locale: uk })}–${formatInTimeZone(endDate, tz, 'HH:mm', { locale: uk })}`
              const svcStr = apt.customServiceName?.trim() || 'Послуга вказана при записі'
              const statusLabel =
                String(apt.status || '').toLowerCase() === 'pending' || apt.status?.toLowerCase().includes('очіку')
                  ? 'Очікує підтвердження'
                  : apt.status?.toLowerCase().includes('підтвер')
                    ? 'Підтверджено'
                    : apt.status || '—'

              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'
              const managePath = apt.business?.slug ? `/booking/${apt.business.slug}/manage/${token}` : null
              const manageUrl = managePath
                ? `${baseUrl.replace(/\/$/, '')}${managePath.startsWith('/') ? '' : '/'}${managePath}`
                : null

              const text =
                `✅ Ви записалися!\n\n` +
                `📅 ${dayStr}, ${timeStr}\n` +
                `👤 Спеціаліст: ${apt.master?.name || '—'}\n` +
                `📋 ${svcStr}\n` +
                `📌 Статус: ${statusLabel}\n\n` +
                (manageUrl
                  ? `🔗 Можете перенести або скасувати запис за посиланням (потрібне підтвердження майстра).`
                  : `Підтвердження та нагадування надходитимуть сюди.`)

              const keyboard = manageUrl
                ? Markup.inlineKeyboard([[Markup.button.url('📌 Відкрити керування записом', manageUrl)]])
                : undefined
              await ctx.reply(text, keyboard)
              return
            }
          } catch (e) {
            console.error('Telegram /start booked_ error:', e)
          }
        }
      }

      const telegramUser = await prisma.telegramUser.findUnique({
        where: { telegramId },
      })

      const settings = await getBotSettings(config.businessId)

      if (telegramUser && telegramUser.businessId === config.businessId) {
        await prisma.telegramUser.update({
          where: { id: telegramUser.id },
          data: {
            username: ctx.from?.username,
            firstName: ctx.from?.first_name,
            lastName: ctx.from?.last_name,
            lastActivity: new Date(),
          },
        })

        const welcome = settings.welcomeMessage?.trim() || DEFAULT_WELCOME
        const text = welcome
          .replace(/\{\{name\}\}/g, ctx.from?.first_name || 'користувач')
          .replace(/\{\{role\}\}/g, getRoleName(telegramUser.role))

        await ctx.reply(text, getMainMenu(telegramUser.role, settings))
        return
      }

      if (telegramUser && telegramUser.businessId !== config.businessId) {
        await ctx.reply('❌ Ви не маєте доступу до цього бота.')
        return
      }

      const newUserMsg = settings.newUserMessage?.trim() || DEFAULT_NEW_USER
      await ctx.reply(newUserMsg, getWriteMessageKeyboard(settings))
    } catch (error) {
      console.error('Error in /start command:', error)
      await ctx.reply('❌ Помилка при обробці команди.')
    }
  })

  // Видалено всі зайві меню (статистика, аналітика, користувачі, моніторинг)
  // Залишено тільки нагадування та сповіщення

  // Callback для створення нагадування
  bot.action('menu_reminder_create', async (ctx: Context) => {
    const user = await getUser(ctx)
    if (!user || !hasPermission(user.role, 'create_broadcast')) {
      await ctx.answerCbQuery('❌ У вас немає прав для створення нагадувань.')
      return
    }

    await ctx.answerCbQuery('⏰ Створення нагадування')
    await ctx.reply(
      `⏰ Створення нагадування\n\n` +
      `Відправте команду:\n` +
      `/reminder <текст нагадування>\n\n` +
      `Приклад:\n` +
      `/reminder Завтра манік 22.00 чекаю )))))\n\n` +
      `Для персонального нагадування:\n` +
      `/reminder @username Завтра манік 22.00 чекаю`
    )
  })

  // Callback для списку нагадувань
  bot.action('menu_reminders', async (ctx: Context) => {
    const user = await getUser(ctx)
    if (!user || !hasPermission(user.role, 'create_broadcast')) {
      await ctx.answerCbQuery('❌ У вас немає прав для перегляду нагадувань.')
      return
    }

    await logAction('callback', 'menu_reminders', null, ctx.from?.id?.toString())

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'
    const reminders = await fetch(`${baseUrl}/api/telegram/reminders?businessId=${config.businessId}`)
      .then(res => res.json())
      .catch(() => [])

    const settings = await getBotSettings(config.businessId)
    if (!reminders || reminders.length === 0) {
      await ctx.editMessageText(
        '📝 Немає створених нагадувань.\n\nОберіть дію:',
        getMainMenu(user.role, settings)
      )
      return
    }

    const remindersText = reminders.slice(0, 5).map((r: any, i: number) => {
      const statusIcon = r.status === 'sent' ? '✅' : r.status === 'pending' ? '⏰' : '❌'
      const targetText = r.targetType === 'client' && r.client ? `для ${r.client.name}` : 'всім'
      return `${statusIcon} ${i + 1}. ${r.message.substring(0, 30)}...\n   ${targetText}`
    }).join('\n\n')

    await ctx.editMessageText(
      `📝 Мої нагадування:\n\n${remindersText}\n\nОберіть дію:`,
      getMainMenu(user.role, settings)
    )
  })

  // Команда /book — початок запису (одне вікно)
  bot.command('book', async (ctx: Context) => {
    const settings = await getBotSettings(config.businessId)
    if (!settings.bookingEnabled) {
      await ctx.reply('Запис через бота вимкнено. Зв\'яжіться з нами напряму.')
      return
    }
    const chatId = String(ctx.chat?.id ?? '')
    const sessionKey = `${config.businessId}:${chatId}`

    const masters = await prisma.master.findMany({
      where: { businessId: config.businessId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 10,
    })

    if (masters.length === 0) {
      await ctx.reply('❌ Немає доступних спеціалістів. Зв\'яжіться з адміністратором.')
      return
    }

    await setBookingState(sessionKey, { step: 'master' })

    const buttons = masters.map((m) => [Markup.button.callback(m.name, `book_m_${m.id}`)])
    buttons.push([Markup.button.callback('❌ Скасувати', 'book_cancel')])

    await ctx.reply('👤 <b>Оберіть спеціаліста:</b>', { parse_mode: 'HTML', reply_markup: Markup.inlineKeyboard(buttons).reply_markup })
  })

  // Відправка інформації про бізнес (одне повідомлення, edit при callback)
  const sendBusinessInfo = async (
    ctx: Context,
    user: Awaited<ReturnType<typeof getUser>>,
    settings: TelegramBotMessageSettings
  ) => {
    const business = await prisma.business.findUnique({
      where: { id: config.businessId },
      select: {
        name: true,
        slug: true,
        phone: true,
        address: true,
        location: true,
        workingHours: true,
        slogan: true,
        description: true,
      },
    })
    if (!business) {
      await editOrReply(ctx, 'Інформація недоступна.')
      return
    }
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'
    const bookingUrl = business.slug ? `${baseUrl.replace(/\/$/, '')}/booking/${business.slug}` : null
    const addr = (business.address || business.location || '').trim()
    const phone = (business.phone || '').trim()
    const slogan = (business.slogan || '').trim()
    const desc = (business.description || '').trim().slice(0, 200)
    const scheduleText = formatWorkingHoursSummary(business.workingHours)
    const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    let text = `🏢 <b>${esc(business.name || 'Бізнес')}</b>\n\n`
    if (slogan) text += `${esc(slogan)}\n\n`
    if (addr) text += `📍 ${esc(addr)}\n`
    if (phone) text += `📞 ${esc(phone)}\n`
    text += `🕐 Графік: ${esc(scheduleText)}\n`
    if (desc) text += `\n${esc(desc)}\n`
    if (bookingUrl) text += `\n🔗 <a href="${bookingUrl}">Записатися онлайн</a>\n\n`
    text += 'Оберіть дію:'

    const menuKb = user && user.businessId === config.businessId ? getMainMenu(user.role, settings) : getWriteMessageKeyboard(settings)
    const menuRows: Array<Array<{ text: string; url?: string; callback_data?: string }>> =
      (menuKb as { reply_markup?: { inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> } })?.reply_markup?.inline_keyboard ?? []
    const showRoute = settings.infoRouteButtonEnabled !== false && addr
    const showCall = settings.infoCallButtonEnabled !== false && phone
    const showBook = settings.infoBookingButtonEnabled !== false && bookingUrl
    const actionButtons: Array<Array<ReturnType<typeof Markup.button.url>>> = []
    if (showRoute) {
      const mapQuery = encodeURIComponent(addr)
      actionButtons.push([Markup.button.url('🗺 Маршрут', `https://www.google.com/maps/search/?api=1&query=${mapQuery}`)])
    }
    if (showCall) {
      const digits = phone.replace(/\D/g, '')
      const tel = digits.startsWith('380') ? `+${digits}` : digits.startsWith('0') ? `+38${digits}` : `+380${digits}`
      actionButtons.push([Markup.button.url('📞 Дзвінок', `tel:${tel}`)])
    }
    if (showBook && bookingUrl) {
      actionButtons.push([Markup.button.url('📅 Записатися', bookingUrl)])
    }
    const allRows = actionButtons.length > 0 ? [...actionButtons, ...menuRows] : menuRows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const keyboard = Markup.inlineKeyboard(allRows as any)

    await editOrReply(ctx, text, { reply_markup: keyboard.reply_markup })
  }

  // Команда /info — інформація про бізнес
  bot.command('info', async (ctx: Context) => {
    const user = await getUser(ctx)
    const settings = await getBotSettings(config.businessId)
    await sendBusinessInfo(ctx, user, settings)
  })

  // Команда для створення нагадування
  bot.command('reminder', async (ctx: Context) => {
    const user = await getUser(ctx)
    if (!user || !hasPermission(user.role, 'create_broadcast')) {
      await ctx.reply('❌ У вас немає прав для створення нагадувань.')
      return
    }

    const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : ''
    const args = messageText ? messageText.split(' ') : []
    const reminderText = args.slice(1).join(' ')

    if (!reminderText) {
      await ctx.reply(
        `⏰ Створення нагадування\n\n` +
        `Використання:\n` +
        `/reminder <текст> - для всіх клієнтів\n\n` +
        `Приклад:\n` +
        `/reminder Завтра манік 22.00 чекаю )))))`
      )
      return
    }

    await logAction('command', 'reminder', reminderText, ctx.from?.id?.toString())

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'
      const response = await fetch(`${baseUrl}/api/telegram/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: config.businessId,
          message: reminderText,
          targetType: 'all',
          createdBy: user.id,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.reminder) {
          await ctx.reply(
            `✅ Нагадування створено!\n\n` +
            `Текст: ${reminderText}\n\n` +
            `Відправити зараз?`,
            Markup.inlineKeyboard([
              [Markup.button.callback('✅ Відправити', `send_reminder_${data.reminder.id}`)],
              [Markup.button.callback('❌ Скасувати', 'menu_cancel')],
            ])
          )
        } else {
          console.error('Unexpected response format:', data)
          await ctx.reply('❌ Помилка: неочікуваний формат відповіді від сервера.')
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Error creating reminder:', response.status, errorData)
        await ctx.reply(
          `❌ Помилка при створенні нагадування.\n` +
          `Код: ${response.status}\n` +
          `Деталі: ${errorData.error || errorData.details || 'Невідома помилка'}`
        )
      }
    } catch (error) {
      console.error('Error creating reminder:', error)
      const errorMessage = error instanceof Error ? error.message : 'Невідома помилка'
      await ctx.reply(`❌ Помилка при створенні нагадування: ${errorMessage}`)
    }
  })

  // Callback для відправки нагадування
  bot.action(/^send_reminder_(.+)$/, async (ctx: Context) => {
    const user = await getUser(ctx)
    if (!user || !hasPermission(user.role, 'create_broadcast')) {
      await ctx.answerCbQuery('❌ У вас немає прав.')
      return
    }

    const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
    const reminderId = callbackData ? callbackData.replace('send_reminder_', '') : ''
    
    if (!reminderId) {
      await ctx.answerCbQuery('❌ Помилка: не вдалося отримати ID нагадування.')
      return
    }
    await ctx.answerCbQuery('⏰ Відправка нагадування...')

    try {
      const settings = await getBotSettings(config.businessId)
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'
      const response = await fetch(`${baseUrl}/api/telegram/reminders/${reminderId}/send`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        await ctx.editMessageText(
          `✅ Нагадування відправлено!\n\n` +
          `Відправлено: ${data.sentCount} клієнтів\n` +
          `Помилок: ${data.failedCount}\n\n` +
          `Оберіть дію:`,
          getMainMenu(user.role, settings)
        )
      } else {
        await ctx.editMessageText('❌ Помилка при відправці нагадування.', getMainMenu(user.role, settings))
      }
    } catch (error) {
      console.error('Error sending reminder:', error)
      const settings = await getBotSettings(config.businessId)
      await ctx.editMessageText('❌ Помилка при відправці.', getMainMenu(user.role, settings))
    }
  })

  // Callback для скасування
  bot.action('menu_cancel', async (ctx: Context) => {
    const user = await getUser(ctx)
    await ctx.answerCbQuery('Скасовано')
    const settings = await getBotSettings(config.businessId)
    await ctx.editMessageText('Операцію скасовано.\n\nОберіть дію:', getMainMenu(user?.role || 'VIEWER', settings))
  })

  // Кнопка «Написати повідомлення» — одне повідомлення, очікує текст
  bot.action('menu_write_message', async (ctx: Context) => {
    const user = await getUser(ctx)
    await ctx.answerCbQuery('✉️ Написати повідомлення')
    const chatId = ctx.chat?.id
    if (chatId) {
      const key = `${config.businessId}:${String(chatId)}`
      awaitingMessageSession.set(key, Date.now())
    }
    const settings = await getBotSettings(config.businessId)
    const menu = user && user.businessId === config.businessId ? getMainMenu(user.role, settings) : getWriteMessageKeyboard(settings)
    const msg = '💬 <b>Напишіть повідомлення</b>\n\nМи отримаємо його та відповімо найближчим часом.\n\nОберіть дію:'
    await editOrReply(ctx, msg, { reply_markup: menu.reply_markup })
  })

  // Кнопка «Інформація про бізнес»
  bot.action('menu_info', async (ctx: Context) => {
    const user = await getUser(ctx)
    await ctx.answerCbQuery('ℹ️ Інформація')
    const settings = await getBotSettings(config.businessId)
    await sendBusinessInfo(ctx, user, settings)
  })

  // Кнопка «Мої записи» — одне повідомлення
  bot.action('menu_my_appointments', async (ctx: Context) => {
    const user = await getUser(ctx)
    await ctx.answerCbQuery('📋 Мої записи')
    const chatId = ctx.chat?.id ? String(ctx.chat.id) : ''
    const settings = await getBotSettings(config.businessId)
    const menu = user && user.businessId === config.businessId ? getMainMenu(user.role, settings) : getWriteMessageKeyboard(settings)

    const client = chatId
      ? await prisma.client.findFirst({
          where: { businessId: config.businessId, telegramChatId: chatId },
          select: { id: true },
        })
      : null

    let text: string
    if (!client) {
      text =
        `📋 <b>Мої записи</b>\n\n` +
        `У вас поки немає записів через цей бот.\n\n` +
        (settings.bookingEnabled ? `Натисніть «📅 Записатися» — після першого візиту тут зʼявляться ваші записи.` : `Запишіться на сайті — тоді тут зʼявлятимуться ваші візити.`) +
        `\n\nОберіть дію:`
    } else {
      const now = new Date()
      const appointments = await prisma.appointment.findMany({
        where: {
          clientId: client.id,
          businessId: config.businessId,
          startTime: { gte: now },
          status: { notIn: ['Cancelled', 'Скасовано'] },
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          status: true,
          customServiceName: true,
          master: { select: { name: true } },
        },
        orderBy: { startTime: 'asc' },
        take: 5,
      })

      const tz = 'Europe/Kyiv'
      if (appointments.length === 0) {
        text = `📋 <b>Мої записи</b>\n\nУ вас немає майбутніх візитів.\n\nТут зʼявлятимуться підтверджені записи та нагадування.\n\nОберіть дію:`
      } else {
        const lines = appointments.map((apt, i) => {
          const start = new Date(apt.startTime)
          const day = formatInTimeZone(start, tz, 'd MMM, HH:mm', { locale: uk })
          const svc = apt.customServiceName?.trim() || '—'
          const statusIcon =
            String(apt.status || '').toLowerCase().includes('підтвер') || apt.status === 'Confirmed'
              ? '✅'
              : String(apt.status || '').toLowerCase().includes('очіку') || apt.status === 'Pending'
                ? '⏳'
                : '📌'
          return `${statusIcon} ${i + 1}. ${day}\n   ${apt.master?.name || '—'} • ${svc}`
        })
        text = `📋 <b>Мої записи</b>\n\n${lines.join('\n\n')}\n\n<i>Нагадування надходитимуть автоматично.</i>\n\nОберіть дію:`
      }
    }
    await editOrReply(ctx, text, { reply_markup: menu.reply_markup })
  })

  // Callback для допомоги — структурований текст, поради, FAQ
  bot.action('menu_help', async (ctx: Context) => {
    const user = await getUser(ctx)
    await logAction('callback', 'menu_help', null, ctx.from?.id?.toString())

    const role = user?.role || 'VIEWER'
    const commands = getAvailableCommands(role)
    const isStaff = user && user.businessId === config.businessId && hasPermission(role, 'create_broadcast')

    let text =
      `ℹ️ *Допомога*\n\n` +
      `📌 *Швидкі дії:*\n` +
      `• ℹ️ Інформація — адреса, графік, телефон, запис онлайн\n` +
      `• 📋 Мої записи — ваші майбутні візити\n` +
      `• ✉️ Написати повідомлення — звʼязок з бізнесом\n\n` +
      `📌 *Команди:*\n${commands.join('\n')}\n\n` +
      `💡 *Порада:* натисніть кнопку «Інформація про бізнес» — там є кнопки для маршруту та дзвінка.\n\n` +
      `_Ваша роль: ${getRoleName(role)}_`

    if (isStaff) {
      text += `\n\n⏰ *Для співробітників:* /reminder <текст> — створити нагадування для клієнтів`
    }

    const settings = await getBotSettings(config.businessId)
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...getMainMenu(role, settings) })
  })

  // ——— Запис через бота (кнопки) ———
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'

  bot.action('book_start', async (ctx: Context) => {
    const settings = await getBotSettings(config.businessId)
    if (!settings.bookingEnabled) {
      await ctx.answerCbQuery('Запис через бота вимкнено.')
      return
    }
    await ctx.answerCbQuery('Запис')
    const chatId = String(ctx.chat?.id ?? '')
    const sessionKey = `${config.businessId}:${chatId}`

    const masters = await prisma.master.findMany({
      where: { businessId: config.businessId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 10,
    })

    if (masters.length === 0) {
      await editOrReply(ctx, '❌ Немає доступних спеціалістів. Зв\'яжіться з адміністратором.')
      return
    }

    await setBookingState(sessionKey, { step: 'master' })

    const buttons = masters.map((m) => [Markup.button.callback(m.name, `book_m_${m.id}`)])
    buttons.push([Markup.button.callback('❌ Скасувати', 'book_cancel')])

    await editOrReply(ctx, '👤 <b>Оберіть спеціаліста:</b>', { reply_markup: Markup.inlineKeyboard(buttons).reply_markup })
  })

  /** Фільтр послуг по майстру: masterIds = null/'' = для всіх; JSON-масив = лише для тих майстрів */
  const filterServicesForMaster = (services: { id: string; name: string; duration: number; price: number; masterIds?: string | null }[], masterId: string) => {
    return services.filter((s) => {
      const raw = s.masterIds
      if (!raw || typeof raw !== 'string' || !raw.trim()) return true
      try {
        const ids = JSON.parse(raw)
        if (!Array.isArray(ids)) return true
        return ids.includes(masterId)
      } catch {
        return true
      }
    })
  }

  /** Крок 1: показуємо дати з вільними слотами */
  const goToSlotDateStep = async (
    ctx: Context,
    sessionKey: string,
    state: BookingState,
    durationMin: number
  ) => {
    const business = await prisma.business.findUnique({
      where: { id: config.businessId },
      select: { settings: true },
    })
    const bookingOptions = parseBookingSlotsOptions(business?.settings ?? null)
    const daysAhead = Math.min(bookingOptions.maxDaysAhead, 14)
    const today = new Date()
    const fromStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const slotsRes = await fetch(
      `${baseUrl}/api/availability?businessId=${config.businessId}&masterId=${state.masterId}&from=${fromStr}&days=${daysAhead}&limit=60&durationMinutes=${durationMin}`
    ).then((r) => r.json())

    const recommendedSlots: Array<{ date: string; time: string; slot: string }> = slotsRes?.recommendedSlots ?? []

    if (recommendedSlots.length === 0) {
      const daysLabel = daysAhead === 1 ? '1 день' : daysAhead < 5 ? `${daysAhead} дні` : `${daysAhead} днів`
      await editOrReply(ctx, `❌ Немає вільних слотів на найближчі ${daysLabel}. Спробуйте пізніше або зв'яжіться з нами.`)
      return
    }

    const datesWithSlots = [...new Set(recommendedSlots.map((s) => s.date))].sort().slice(0, 10)

    await setBookingState(sessionKey, {
      ...state,
      step: 'slot_date',
      durationMinutes: durationMin,
    })

    const dateButtons: ReturnType<typeof Markup.button.callback>[][] = []
    for (let i = 0; i < datesWithSlots.length; i += 2) {
      const row = datesWithSlots.slice(i, i + 2).map((d) => {
        try {
          const dt = parseISO(d + 'T12:00:00')
          const label = format(dt, 'EEE d.MM', { locale: uk })
          return Markup.button.callback(label, `book_date_${d}`)
        } catch {
          return Markup.button.callback(`${d.slice(8, 10)}.${d.slice(5, 7)}`, `book_date_${d}`)
        }
      })
      dateButtons.push(row)
    }
    const settingsForDate = await getBotSettings(config.businessId)
    const modeForDate = settingsForDate.bookingServiceMode || 'both'
    const hasServiceChoice = modeForDate !== 'simple_only' && (!!state.serviceId || state.withoutService === true)
    if (hasServiceChoice) {
      dateButtons.push([Markup.button.callback('◀️ Інша послуга', 'book_back_to_service')])
    }
    dateButtons.push([Markup.button.callback('◀️ Інший спеціаліст', 'book_start')])
    dateButtons.push([Markup.button.callback('❌ Скасувати', 'book_cancel')])

    await editOrReply(ctx, '📅 <b>Оберіть дату:</b>', { reply_markup: Markup.inlineKeyboard(dateButtons).reply_markup })
  }

  /** Крок 2: показуємо години на обрану дату */
  const goToSlotTimeStep = async (
    ctx: Context,
    sessionKey: string,
    state: BookingState,
    dateNorm: string,
    durationMin: number
  ) => {
    const slotsRes = await fetch(
      `${baseUrl}/api/availability?businessId=${config.businessId}&masterId=${state.masterId}&date=${dateNorm}&durationMinutes=${durationMin}`
    ).then((r) => r.json())

    const availableSlots: string[] = slotsRes?.availableSlots ?? []

    if (availableSlots.length === 0) {
      await editOrReply(ctx, '❌ На цю дату немає вільних слотів. Оберіть іншу дату.')
      return goToSlotDateStep(ctx, sessionKey, { ...state, step: 'slot_date', durationMinutes: durationMin }, durationMin)
    }

    const dateLabel = (() => {
      try {
        return format(parseISO(dateNorm + 'T12:00:00'), 'd MMMM', { locale: uk })
      } catch {
        return `${dateNorm.slice(8, 10)}.${dateNorm.slice(5, 7)}`
      }
    })()

    await setBookingState(sessionKey, {
      ...state,
      step: 'slot_time',
      selectedDate: dateNorm,
      durationMinutes: durationMin,
    })

    const slotsToShow = availableSlots.slice(0, 18)
    const timeButtons: ReturnType<typeof Markup.button.callback>[][] = []
    for (let i = 0; i < slotsToShow.length; i += 3) {
      const row = slotsToShow.slice(i, i + 3).map((slot) => {
        const time = slot.slice(11, 16)
        const slotSafe = slot.replace(/:/g, '_')
        return Markup.button.callback(time, `book_slot_${slotSafe}`)
      })
      timeButtons.push(row)
    }
    const settingsForTime = await getBotSettings(config.businessId)
    const modeForTime = settingsForTime.bookingServiceMode || 'both'
    const hasServiceChoice = modeForTime !== 'simple_only' && (!!state.serviceId || state.withoutService === true)
    timeButtons.push([Markup.button.callback('◀️ Інша дата', 'book_back_dates')])
    if (hasServiceChoice) {
      timeButtons.push([Markup.button.callback('◀️ Інша послуга', 'book_back_to_service')])
    }
    timeButtons.push([Markup.button.callback('◀️ Інший спеціаліст', 'book_start')])
    timeButtons.push([Markup.button.callback('❌ Скасувати', 'book_cancel')])

    await editOrReply(ctx, `🕐 <b>Оберіть час на ${dateLabel}:</b>`, { reply_markup: Markup.inlineKeyboard(timeButtons).reply_markup })
  }

  bot.action(/^book_m_(.+)$/, async (ctx: Context) => {
    const settings = await getBotSettings(config.businessId)
    if (!settings.bookingEnabled) {
      await ctx.answerCbQuery('Запис вимкнено.')
      return
    }
    const data = typeof (ctx.callbackQuery as any)?.data === 'string' ? (ctx.callbackQuery as any).data : ''
    const match = data.match(/^book_m_(.+)$/)
    const masterId = match?.[1]?.trim?.()
    if (!masterId) return

    const master = await prisma.master.findFirst({
      where: { id: masterId, businessId: config.businessId, isActive: true },
      select: { id: true, name: true },
    })
    if (!master) {
      await ctx.answerCbQuery('Спеціаліст не знайдено.')
      return
    }

    await ctx.answerCbQuery(master.name)

    const chatId = String(ctx.chat?.id ?? '')
    const sessionKey = `${config.businessId}:${chatId}`

    const business = await prisma.business.findUnique({
      where: { id: config.businessId },
      select: { settings: true },
    })
    const bookingOptions = parseBookingSlotsOptions(business?.settings ?? null)
    const durationMin = [15, 30, 60].includes(bookingOptions.slotStepMinutes)
      ? bookingOptions.slotStepMinutes
      : 30

    const mode = settings.bookingServiceMode || 'both'

    if (mode === 'simple_only') {
      const baseState: BookingState = {
        step: 'slot',
        masterId: master.id,
        masterName: master.name,
        withoutService: true,
        durationMinutes: durationMin,
      }
      await goToSlotDateStep(ctx, sessionKey, baseState, durationMin)
      return
    }

    if (mode === 'both') {
      await setBookingState(sessionKey, {
        step: 'service_choice',
        masterId: master.id,
        masterName: master.name,
        durationMinutes: durationMin,
      })
      const choiceButtons = [
        [Markup.button.callback('📋 З прайсу', 'book_show_services')],
        [Markup.button.callback('⏱ Без послуги', 'book_without_svc')],
        [Markup.button.callback('◀️ Інший спеціаліст', 'book_start')],
        [Markup.button.callback('❌ Скасувати', 'book_cancel')],
      ]
      await editOrReply(ctx, '<b>Оберіть варіант запису:</b>', { reply_markup: Markup.inlineKeyboard(choiceButtons).reply_markup })
      return
    }

    if (mode === 'pricelist_only') {
      const services = await prisma.service.findMany({
        where: { businessId: config.businessId, isActive: true },
        select: { id: true, name: true, duration: true, price: true, masterIds: true },
        orderBy: { name: 'asc' },
        take: 20,
      })
      const filtered = filterServicesForMaster(services, master.id)

      if (filtered.length === 0) {
        const baseState: BookingState = {
          step: 'slot',
          masterId: master.id,
          masterName: master.name,
          withoutService: true,
          durationMinutes: durationMin,
        }
        await goToSlotDateStep(ctx, sessionKey, baseState, durationMin)
        return
      }

      await setBookingState(sessionKey, {
        step: 'service',
        masterId: master.id,
        masterName: master.name,
        durationMinutes: durationMin,
      })
      const svcButtons = filtered.slice(0, 12).map((s) => [
        Markup.button.callback(
          `${s.name} · ${s.price} грн`,
          `book_svc_${s.id}`
        ),
      ])
      svcButtons.push([Markup.button.callback('◀️ Інший спеціаліст', 'book_start')])
      svcButtons.push([Markup.button.callback('◀️ Інший спеціаліст', 'book_start')])
      svcButtons.push([Markup.button.callback('❌ Скасувати', 'book_cancel')])
      await editOrReply(ctx, '📋 <b>Оберіть послугу з прайсу:</b>', { reply_markup: Markup.inlineKeyboard(svcButtons).reply_markup })
      return
    }

    await goToSlotDateStep(ctx, sessionKey, {
      step: 'slot_date',
      masterId: master.id,
      masterName: master.name,
      durationMinutes: durationMin,
    }, durationMin)
  })

  bot.action('book_show_services', async (ctx: Context) => {
    const settings = await getBotSettings(config.businessId)
    if (!settings.bookingEnabled) return

    const chatId = String(ctx.chat?.id ?? '')
    const sessionKey = `${config.businessId}:${chatId}`
    const state = await getBookingState(sessionKey)
    if (!state || state.step !== 'service_choice' || !state.masterId) {
      await ctx.answerCbQuery('Час вийшов. /start → Записатися')
      return
    }

    await ctx.answerCbQuery('З прайсу')

    const services = await prisma.service.findMany({
      where: { businessId: config.businessId, isActive: true },
      select: { id: true, name: true, duration: true, price: true, masterIds: true },
      orderBy: { name: 'asc' },
      take: 20,
    })
    const filtered = filterServicesForMaster(services, state.masterId)

    if (filtered.length === 0) {
      const choiceButtons = [
        [Markup.button.callback('⏱ Без послуги', 'book_without_svc')],
        [Markup.button.callback('❌ Скасувати', 'book_cancel')],
      ]
      await editOrReply(ctx, 'Немає послуг у прайсі. Оберіть «Без послуги»:', { reply_markup: Markup.inlineKeyboard(choiceButtons).reply_markup })
      return
    }

    await setBookingState(sessionKey, { ...state, step: 'service' })
    const svcButtons = filtered.slice(0, 12).map((s) => [
      Markup.button.callback(`${s.name} · ${s.price} грн`, `book_svc_${s.id}`),
    ])
    svcButtons.push([Markup.button.callback('◀️ Інший спеціаліст', 'book_start')])
    svcButtons.push([Markup.button.callback('❌ Скасувати', 'book_cancel')])
    await editOrReply(ctx, '📋 <b>Оберіть послугу з прайсу:</b>', { reply_markup: Markup.inlineKeyboard(svcButtons).reply_markup })
  })

  bot.action('book_without_svc', async (ctx: Context) => {
    const settings = await getBotSettings(config.businessId)
    if (!settings.bookingEnabled) return

    const chatId = String(ctx.chat?.id ?? '')
    const sessionKey = `${config.businessId}:${chatId}`
    const state = await getBookingState(sessionKey)
    if (!state || !state.masterId || !state.masterName) {
      await ctx.answerCbQuery('Час вийшов. /start → Записатися')
      return
    }

    await ctx.answerCbQuery('Без послуги')

    const durationMin = state.durationMinutes ?? 30
    const baseState: BookingState = {
      ...state,
      step: 'slot_date',
      withoutService: true,
      durationMinutes: durationMin,
    }
    await goToSlotDateStep(ctx, sessionKey, baseState, durationMin)
  })

  bot.action(/^book_svc_(.+)$/, async (ctx: Context) => {
    const settings = await getBotSettings(config.businessId)
    if (!settings.bookingEnabled) return

    const data = typeof (ctx.callbackQuery as any)?.data === 'string' ? (ctx.callbackQuery as any).data : ''
    const match = data.match(/^book_svc_(.+)$/)
    const serviceId = match?.[1]?.trim?.()
    if (!serviceId) return

    const chatId = String(ctx.chat?.id ?? '')
    const sessionKey = `${config.businessId}:${chatId}`
    const state = await getBookingState(sessionKey)
    if (!state || (state.step !== 'service' && state.step !== 'service_choice') || !state.masterId) {
      await ctx.answerCbQuery('Час вийшов. /start → Записатися')
      return
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, businessId: config.businessId, isActive: true },
      select: { id: true, name: true, duration: true, price: true },
    })
    if (!service) {
      await ctx.answerCbQuery('Послугу не знайдено.')
      return
    }

    await ctx.answerCbQuery(service.name)

    const durationMin = Math.max(15, Math.min(480, service.duration || 30))
    const baseState: BookingState = {
      ...state,
      step: 'slot_date',
      serviceId: service.id,
      serviceName: service.name,
      serviceDuration: durationMin,
      servicePrice: service.price,
      withoutService: false,
      durationMinutes: durationMin,
    }
    await goToSlotDateStep(ctx, sessionKey, baseState, durationMin)
  })

  bot.action(/^book_date_(.+)$/, async (ctx: Context) => {
    const settings = await getBotSettings(config.businessId)
    if (!settings.bookingEnabled) return

    const data = typeof (ctx.callbackQuery as any)?.data === 'string' ? (ctx.callbackQuery as any).data : ''
    const match = data.match(/^book_date_(.+)$/)
    const dateNorm = match?.[1]?.trim?.()
    if (!dateNorm || !/^\d{4}-\d{2}-\d{2}$/.test(dateNorm)) return

    const chatId = String(ctx.chat?.id ?? '')
    const sessionKey = `${config.businessId}:${chatId}`
    const state = await getBookingState(sessionKey)
    if (!state || state.step !== 'slot_date' || !state.masterId) {
      await ctx.answerCbQuery('Час вийшов. /start → Записатися')
      return
    }

    await ctx.answerCbQuery(dateNorm)

    const durationMin = state.durationMinutes ?? 30
    await goToSlotTimeStep(ctx, sessionKey, state, dateNorm, durationMin)
  })

  bot.action('book_back_dates', async (ctx: Context) => {
    const settings = await getBotSettings(config.businessId)
    if (!settings.bookingEnabled) return

    const chatId = String(ctx.chat?.id ?? '')
    const sessionKey = `${config.businessId}:${chatId}`
    const state = await getBookingState(sessionKey)
    if (!state || (state.step !== 'slot_time' && state.step !== 'slot_date') || !state.masterId) {
      await ctx.answerCbQuery('Час вийшов. /start → Записатися')
      return
    }

    await ctx.answerCbQuery('Інша дата')
    const durationMin = state.durationMinutes ?? 30
    const backState: BookingState = { ...state, step: 'slot_date', selectedDate: undefined }
    await goToSlotDateStep(ctx, sessionKey, backState, durationMin)
  })

  bot.action('book_back_to_service', async (ctx: Context) => {
    const settings = await getBotSettings(config.businessId)
    if (!settings.bookingEnabled) return
    const chatId = String(ctx.chat?.id ?? '')
    const sessionKey = `${config.businessId}:${chatId}`
    const state = await getBookingState(sessionKey)
    if (!state || !state.masterId || !state.masterName) {
      await ctx.answerCbQuery('Час вийшов. /start → Записатися')
      return
    }
    await ctx.answerCbQuery('Інша послуга')
    const mode = settings.bookingServiceMode || 'both'
    if (mode === 'simple_only') {
      const masters = await prisma.master.findMany({
        where: { businessId: config.businessId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 10,
      })
      await setBookingState(sessionKey, { step: 'master' })
      const buttons = masters.map((m) => [Markup.button.callback(m.name, `book_m_${m.id}`)])
      buttons.push([Markup.button.callback('❌ Скасувати', 'book_cancel')])
      await editOrReply(ctx, '👤 <b>Оберіть спеціаліста:</b>', { reply_markup: Markup.inlineKeyboard(buttons).reply_markup })
      return
    }
    const durationMin = state.durationMinutes ?? 30
    if (mode === 'both') {
      await setBookingState(sessionKey, { step: 'service_choice', masterId: state.masterId, masterName: state.masterName, durationMinutes: durationMin })
      const choiceButtons = [
        [Markup.button.callback('📋 З прайсу', 'book_show_services')],
        [Markup.button.callback('⏱ Без послуги', 'book_without_svc')],
        [Markup.button.callback('◀️ Інший спеціаліст', 'book_start')],
        [Markup.button.callback('❌ Скасувати', 'book_cancel')],
      ]
      await editOrReply(ctx, '<b>Оберіть варіант запису:</b>', { reply_markup: Markup.inlineKeyboard(choiceButtons).reply_markup })
      return
    }
    const services = await prisma.service.findMany({
      where: { businessId: config.businessId, isActive: true },
      select: { id: true, name: true, duration: true, price: true, masterIds: true },
      orderBy: { name: 'asc' },
      take: 20,
    })
    const filtered = filterServicesForMaster(services, state.masterId)
    if (filtered.length === 0) {
      const baseState: BookingState = { ...state, step: 'slot_date', withoutService: true, durationMinutes: durationMin }
      await goToSlotDateStep(ctx, sessionKey, baseState, durationMin)
      return
    }
    await setBookingState(sessionKey, { step: 'service', masterId: state.masterId, masterName: state.masterName, durationMinutes: durationMin })
    const svcButtons = filtered.slice(0, 12).map((s) => [Markup.button.callback(`${s.name} · ${s.price} грн`, `book_svc_${s.id}`)])
    svcButtons.push([Markup.button.callback('◀️ Інший спеціаліст', 'book_start')])
    svcButtons.push([Markup.button.callback('❌ Скасувати', 'book_cancel')])
    await editOrReply(ctx, '📋 <b>Оберіть послугу з прайсу:</b>', { reply_markup: Markup.inlineKeyboard(svcButtons).reply_markup })
  })

  bot.action(/^book_slot_(.+)$/, async (ctx: Context) => {
    const settings = await getBotSettings(config.businessId)
    if (!settings.bookingEnabled) return

    const data = typeof (ctx.callbackQuery as any)?.data === 'string' ? (ctx.callbackQuery as any).data : ''
    const match = data.match(/^book_slot_(.+)$/)
    const slotRaw = match?.[1]?.trim?.()
    if (!slotRaw) return

    const chatId = String(ctx.chat?.id ?? '')
    const sessionKey = `${config.businessId}:${chatId}`
    const state = await getBookingState(sessionKey)
    if (!state || (state.step !== 'slot' && state.step !== 'slot_time') || !state.masterId || !state.masterName) {
      await ctx.answerCbQuery('Час вийшов. /start → Записатися')
      return
    }

    const slot = slotRaw.replace(/_/g, ':')
    const slotLabel = slot.length >= 16 ? `${slot.slice(8, 10)}.${slot.slice(5, 7)} ${slot.slice(11, 16)}` : slot

    await ctx.answerCbQuery(slotLabel)

    const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const serviceInfo = state.serviceName ? `\nПослуга: ${esc(state.serviceName)}` : state.withoutService ? '\nБез послуги (консультація)' : ''

    await setBookingState(sessionKey, {
      ...state,
      step: 'contact',
      slot,
      slotLabel,
    })

    const contactBtns = [
      [Markup.button.callback('◀️ Змінити час', 'book_back_to_time')],
      [Markup.button.callback('❌ Скасувати', 'book_cancel')],
    ]
    await editOrReply(
      ctx,
      `📞 <b>Один крок до запису</b>\n\n` +
        `Перевірте дані:\n` +
        `👤 Спеціаліст: ${esc(state.masterName || '')}\n` +
        `🕐 Дата та час: ${slotLabel}${serviceInfo}\n\n` +
        `📱 Натисніть кнопку нижче:`,
      { reply_markup: Markup.inlineKeyboard(contactBtns).reply_markup }
    )
    await ctx.reply('Оберіть дію:', {
      reply_markup: Markup.keyboard([
        [Markup.button.contactRequest('📱 Поділитися номером')],
        [Markup.button.text('◀️ Змінити час'), Markup.button.text('❌ Скасувати')],
      ])
        .resize()
        .oneTime()
        .reply_markup,
    })
  })

  bot.action('book_back_to_time', async (ctx: Context) => {
    const settings = await getBotSettings(config.businessId)
    if (!settings.bookingEnabled) return
    const chatId = String(ctx.chat?.id ?? '')
    const sessionKey = `${config.businessId}:${chatId}`
    const state = await getBookingState(sessionKey)
    if (!state || state.step !== 'contact' || !state.masterId || !state.selectedDate) {
      await ctx.answerCbQuery('Час вийшов. Почніть з /start')
      return
    }
    await ctx.answerCbQuery('Змінити час')
    const durationMin = state.durationMinutes ?? 30
    const backState: BookingState = { ...state, step: 'slot_time', slot: undefined, slotLabel: undefined }
    await goToSlotTimeStep(ctx, sessionKey, backState, state.selectedDate, durationMin)
    await ctx.reply(' ', { reply_markup: Markup.removeKeyboard().reply_markup }).catch(() => {})
  })

  bot.action('book_cancel', async (ctx: Context) => {
    await ctx.answerCbQuery('Скасовано')
    const chatId = String(ctx.chat?.id ?? '')
    await deleteBookingState(`${config.businessId}:${chatId}`)
    const user = await getUser(ctx)
    const settings = await getBotSettings(config.businessId)
    const menu = user && user.businessId === config.businessId ? getMainMenu(user.role, settings) : getWriteMessageKeyboard(settings)
    await editOrReply(ctx, '❌ Запис скасовано.\n\nОберіть дію нижче:', { reply_markup: menu.reply_markup })
    await ctx.reply(' ', { reply_markup: Markup.removeKeyboard().reply_markup }).catch(() => {})
  })

  bot.on('contact', async (ctx) => {
    const contact = ctx.message?.contact
    const chatId = ctx.chat?.id
    if (!contact?.phone_number || !chatId) return

    const sessionKey = `${config.businessId}:${String(chatId)}`
    const state = await getBookingState(sessionKey)
    if (!state || state.step !== 'contact' || !state.masterId || !state.slot) {
      await ctx.reply('⏱ Час очікування вийшов. Напишіть /start та оберіть «Записатися» знову.')
      return
    }

    const phone = contact.phone_number.replace(/\s/g, '')
    const { normalizeUaPhone, isValidUaPhone } = await import('@/lib/utils/phone')
    const normalizedPhone = normalizeUaPhone(phone)
    if (!isValidUaPhone(normalizedPhone)) {
      await ctx.reply('❌ Невірний формат. Введіть номер у форматі: 0671234567')
      return
    }

    const clientName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || 'Клієнт'
    const durationMin = state.durationMinutes ?? 30
    const servicesPayload = state.serviceId ? [state.serviceId] : []
    const customServiceName = state.withoutService ? 'Консультація (без послуги)' : undefined

    try {
      const res = await fetch(`${baseUrl}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: config.businessId,
          masterId: state.masterId,
          clientName,
          clientPhone: normalizedPhone,
          slot: state.slot,
          durationMinutes: durationMin,
          services: servicesPayload,
          customServiceName,
          isFromBooking: true,
          source: 'telegram',
          telegramChatId: String(chatId),
        }),
      })
      const data = await res.json()

      await deleteBookingState(sessionKey)

      if (res.ok && !data.error) {
        const svcLine = state.serviceName
          ? `\nПослуга: ${state.serviceName}`
          : state.withoutService
            ? '\nБез послуги (консультація)'
            : ''
        const managePath = data.manageUrl
        const fullManageUrl = managePath
          ? `${baseUrl.replace(/\/$/, '')}${managePath.startsWith('/') ? '' : '/'}${managePath}`
          : null
        const text =
          `✅ <b>Запис створено!</b>\n\n` +
          `👤 ${state.masterName} · ${state.slotLabel}${svcLine}\n\n` +
          `📩 Ми підтвердимо запис найближчим часом. Сповіщення надійде сюди.`
        await ctx.reply(' ', { reply_markup: Markup.removeKeyboard().reply_markup }).catch(() => {})
        if (fullManageUrl) {
          await ctx.reply(text, {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([[Markup.button.url('🔗 Керувати записом', fullManageUrl)]]).reply_markup,
          })
        } else {
          await ctx.reply(text, { parse_mode: 'HTML' })
        }
      } else {
        const errMsg = data?.error || data?.message || 'Не вдалося створити запис.'
        await ctx.reply(`❌ ${errMsg}\n\nСпробуйте інший час або зв'яжіться з нами.`)
      }
    } catch (err: unknown) {
      await deleteBookingState(sessionKey)
      await ctx.reply('❌ Помилка з\'єднання. Спробуйте пізніше.')
      console.error('Telegram booking error:', err)
    }
  })

  // Будь-яке текстове повідомлення (не команда) — зберігаємо тільки якщо дозволено (кнопка або settings)
  bot.on('text', async (ctx) => {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : ''
    if (!text || text.startsWith('/')) return // команди вже оброблені вище

    const from = ctx.from
    const chatId = ctx.chat?.id
    if (!from || !chatId) return

    const sessionKey = `${config.businessId}:${String(chatId)}`
    const bookingState = await getBookingState(sessionKey)
    const settings = await getBotSettings(config.businessId)
    const messagesOnlyViaButton = settings.messagesOnlyViaButton !== false // default true

    // Очистка застарілих сесій (старші 5 хв)
    const now = Date.now()
    for (const [k, ts] of awaitingMessageSession.entries()) {
      if (now - ts > 5 * 60 * 1000) awaitingMessageSession.delete(k)
    }

    const isAwaitingMessage = awaitingMessageSession.has(sessionKey)

    // Якщо користувач у потоці запису (вводить телефон) — дозволити без перевірки кнопки
    const isBookingContactStep = bookingState?.step === 'contact' && bookingState.masterId && bookingState.slot

    if (!isBookingContactStep && messagesOnlyViaButton && !isAwaitingMessage) {
      // Заборона — тільки через кнопку
      const denyMsg =
        '💬 Щоб написати нам, натисніть кнопку «✉️ Написати повідомлення» нижче.'
      await ctx.reply(denyMsg, getWriteMessageKeyboard(settings))
      return
    }

    if (isAwaitingMessage) {
      awaitingMessageSession.delete(sessionKey)
    }

    const senderName = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || `ID ${from.id}`

    try {
    // Якщо це крок контакту — обробляємо кнопки або телефон
    if (isBookingContactStep && bookingState) {
      if (text.trim() === '◀️ Змінити час') {
        const durationMin = bookingState.durationMinutes ?? 30
        const backState: BookingState = { ...bookingState, step: 'slot_time', slot: undefined, slotLabel: undefined }
        await goToSlotTimeStep(ctx, sessionKey, backState, bookingState.selectedDate!, durationMin)
        await ctx.reply(' ', { reply_markup: Markup.removeKeyboard().reply_markup })
        return
      }
      if (text.trim() === '❌ Скасувати') {
        await deleteBookingState(sessionKey)
        const user = await getUser(ctx)
        const set = await getBotSettings(config.businessId)
        const menu = user && user.businessId === config.businessId ? getMainMenu(user.role, set) : getWriteMessageKeyboard(set)
        await ctx.reply('❌ Запис скасовано.', { reply_markup: Markup.removeKeyboard().reply_markup })
        await ctx.reply('Оберіть дію:', menu)
        return
      }
      const { normalizeUaPhone, isValidUaPhone } = await import('@/lib/utils/phone')
      const normalizedPhone = normalizeUaPhone(text)
        if (isValidUaPhone(normalizedPhone)) {
          const clientName = [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Клієнт'
          const durationMin = bookingState.durationMinutes ?? 30
          const servicesPayload = bookingState.serviceId ? [bookingState.serviceId] : []
          const customServiceName = bookingState.withoutService ? 'Консультація (без послуги)' : undefined
          try {
            const res = await fetch(`${baseUrl}/api/appointments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                businessId: config.businessId,
                masterId: bookingState.masterId,
                clientName,
                clientPhone: normalizedPhone,
                slot: bookingState.slot,
                durationMinutes: durationMin,
                services: servicesPayload,
                customServiceName,
                isFromBooking: true,
                source: 'telegram',
                telegramChatId: String(chatId),
              }),
            })
            const data = await res.json()
            await deleteBookingState(sessionKey)

            if (res.ok && !data.error) {
              await ctx.reply(' ', { reply_markup: Markup.removeKeyboard().reply_markup }).catch(() => {})
              const svcLine = bookingState.serviceName
                ? `\nПослуга: ${bookingState.serviceName}`
                : bookingState.withoutService
                  ? '\nБез послуги (консультація)'
                  : ''
              const managePath = data.manageUrl
              const fullManageUrl = managePath
                ? `${baseUrl.replace(/\/$/, '')}${managePath.startsWith('/') ? '' : '/'}${managePath}`
                : null
              const text =
                `✅ <b>Запис створено!</b>\n\n` +
                `👤 ${bookingState.masterName} · ${bookingState.slotLabel}${svcLine}\n\n` +
                `📩 Ми підтвердимо запис найближчим часом. Сповіщення надійде сюди.`
              if (fullManageUrl) {
                await ctx.reply(text, {
                  parse_mode: 'HTML',
                  reply_markup: Markup.inlineKeyboard([[Markup.button.url('🔗 Керувати записом', fullManageUrl)]]).reply_markup,
                })
              } else {
                await ctx.reply(text, { parse_mode: 'HTML' })
              }
            } else {
              const errMsg = data?.error || data?.message || 'Не вдалося створити запис.'
              await ctx.reply(`❌ ${errMsg}\n\nСпробуйте інший час або зв'яжіться з нами.`)
            }
          } catch (err: unknown) {
            await deleteBookingState(sessionKey)
            await ctx.reply('❌ Помилка з\'єднання. Спробуйте пізніше.')
            console.error('Telegram booking error:', err)
          }
          return
        }
        await ctx.reply('❌ Невірний формат. Введіть номер: 0671234567 (10 цифр)')
        return
      }

      // Звичайне повідомлення — зберігаємо в кабінет
      await prisma.socialInboxMessage.create({
        data: {
          businessId: config.businessId,
          platform: 'telegram',
          direction: 'inbound',
          externalId: String(ctx.message && 'message_id' in ctx.message ? ctx.message.message_id : ''),
          externalChatId: String(chatId),
          senderId: String(from.id),
          senderName,
          message: text,
          isRead: false,
        },
      })
      const autoReply = settings.autoReplyMessage?.trim() || DEFAULT_AUTO_REPLY
      await ctx.reply(autoReply, getWriteMessageKeyboard(settings))
    } catch (err) {
      console.error('Error saving Telegram inbox message:', err)
      await ctx.reply('❌ Не вдалося зберегти повідомлення. Спробуйте пізніше.')
    }
  })

  // Обробка помилок
  bot.catch((err, ctx) => {
    console.error('Telegram bot error:', err)
    ctx.reply('❌ Сталася помилка. Спробуйте пізніше.')
  })

  return bot
}

function getAvailableCommands(role: string): string[] {
  const permissions: Record<string, string[]> = {
    DEVELOPER: ['*'],
    OWNER: ['create_broadcast'],
    ADMIN: ['create_broadcast'],
    MANAGER: ['create_broadcast'],
    EMPLOYEE: [],
    CLIENT: ['receive_broadcast'],
    VIEWER: [],
  }
  const rolePermissions = permissions[role] || []
  const hasPermission = (perm: string) => rolePermissions.includes('*') || rolePermissions.includes(perm)

  const commands: string[] = [
    '/start - Початок роботи / активація',
    '/info - Інформація про бізнес (адреса, телефон, графік, онлайн-запис)',
  ]
  if (hasPermission('create_broadcast')) {
    commands.push('⏰ Створення нагадувань - /reminder <текст>')
  }
  commands.push('ℹ️ Ви отримуватимете сповіщення про нові записи автоматично')
  return commands
}

function getRoleName(role: string): string {
  const roles: Record<string, string> = {
    DEVELOPER: 'Розробник',
    OWNER: 'Власник',
    ADMIN: 'Адміністратор',
    MANAGER: 'Менеджер',
    EMPLOYEE: 'Співробітник',
    CLIENT: 'Клієнт',
    VIEWER: 'Переглядач',
  }
  return roles[role] || role
}

