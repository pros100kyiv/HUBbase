import { Telegraf, Context, Markup } from 'telegraf'
import { format, parseISO } from 'date-fns'
import { uk } from 'date-fns/locale'
import { prisma } from './prisma'
import { parseBookingSlotsOptions } from './utils/booking-settings'

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

const DEFAULT_WELCOME = '✅ Вітаємо, {{name}}!\n\nВаша роль: {{role}}\n\nВи отримуватимете сповіщення про нові записи та нагадування.\n\nОберіть дію:'
const DEFAULT_NEW_USER = '👋 Цей бот для сповіщень від бізнесу.\n\nДля доступу зверніться до адміністратора.'
const DEFAULT_AUTO_REPLY = '✅ Дякуємо! Ваше повідомлення отримано. Ми відповімо найближчим часом.'

async function getBotSettings(businessId: string): Promise<TelegramBotMessageSettings> {
  try {
    const b = await prisma.business.findUnique({
      where: { id: businessId },
      select: { telegramSettings: true },
    })
    if (b?.telegramSettings) {
      return JSON.parse(b.telegramSettings) as TelegramBotMessageSettings
    }
  } catch {}
  return {}
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

  // Клавіатура «Написати повідомлення» — для клієнтів та нових користувачів
  const getWriteMessageKeyboard = (bookingEnabled: boolean) => {
    const buttons: any[] = [[Markup.button.callback('✉️ Написати повідомлення', 'menu_write_message')]]
    if (bookingEnabled) {
      buttons.unshift([Markup.button.callback('📅 Записатися до спеціаліста', 'book_start')])
    }
    return Markup.inlineKeyboard(buttons)
  }

  // Головне меню з кнопками (спрощене - тільки сповіщення)
  const getMainMenu = (role: string) => {
    const buttons: any[] = []

    // Тільки сповіщення та нагадування
    if (hasPermission(role, 'create_broadcast')) {
      buttons.push([Markup.button.callback('⏰ Створити нагадування', 'menu_reminder_create')])
      buttons.push([Markup.button.callback('📝 Мої нагадування', 'menu_reminders')])
    }

    buttons.push([Markup.button.callback('✉️ Написати повідомлення', 'menu_write_message')])
    buttons.push([Markup.button.callback('ℹ️ Допомога', 'menu_help')])

    return Markup.inlineKeyboard(buttons)
  }

  // Команда /start
  bot.command('start', async (ctx: Context) => {
    try {
      const telegramId = BigInt(ctx.from?.id || 0)

      await logAction('command', 'start', null, ctx.from?.id?.toString())

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

        await ctx.reply(text, getMainMenu(telegramUser.role))
        return
      }

      if (telegramUser && telegramUser.businessId !== config.businessId) {
        await ctx.reply('❌ Ви не маєте доступу до цього бота.')
        return
      }

      const newUserMsg = settings.newUserMessage?.trim() || DEFAULT_NEW_USER
      await ctx.reply(newUserMsg, getWriteMessageKeyboard(!!settings.bookingEnabled))
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

    if (!reminders || reminders.length === 0) {
      await ctx.editMessageText(
        '📝 Немає створених нагадувань.\n\nОберіть дію:',
        getMainMenu(user.role)
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
      getMainMenu(user.role)
    )
  })

  // Команда /book — початок запису (для клієнтів)
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

    bookingSession.set(sessionKey, { step: 'master' })

    const buttons = masters.map((m) => [Markup.button.callback(m.name, `book_m_${m.id}`)])
    buttons.push([Markup.button.callback('❌ Скасувати', 'book_cancel')])

    await ctx.reply('👤 Оберіть спеціаліста:', Markup.inlineKeyboard(buttons))
  })

  // Команда /info — інформація про бізнес (як кнопка «Інформація про бізнес»)
  bot.command('info', async (ctx: Context) => {
    const user = await getUser(ctx)
    const business = await prisma.business.findUnique({
      where: { id: config.businessId },
      select: { name: true, slug: true, phone: true, address: true, location: true, workingHours: true },
    })
    if (!business) {
      await ctx.reply('Інформація недоступна.')
      return
    }
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'
    const bookingUrl = business.slug ? `${baseUrl.replace(/\/$/, '')}/booking/${business.slug}` : null
    let text = `🏢 *${business.name || 'Бізнес'}*\n\n`
    if (business.address?.trim()) text += `📍 Адреса: ${business.address}\n`
    if (business.location?.trim()) text += `📍 ${business.location}\n`
    if (business.phone?.trim()) text += `📞 Телефон: ${business.phone}\n`
    if (business.workingHours?.trim()) text += `🕐 Графік: ${business.workingHours}\n`
    if (bookingUrl) text += `\n🔗 Запис онлайн: ${bookingUrl}`
    await ctx.reply(text, { parse_mode: 'Markdown' })
    if (user && user.businessId === config.businessId) {
      await ctx.reply('Оберіть дію:', getMainMenu(user.role))
    } else {
      const settings = await getBotSettings(config.businessId)
      await ctx.reply('Оберіть дію:', getWriteMessageKeyboard(!!settings.bookingEnabled))
    }
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
          getMainMenu(user.role)
        )
      } else {
        await ctx.editMessageText('❌ Помилка при відправці нагадування.', getMainMenu(user.role))
      }
    } catch (error) {
      console.error('Error sending reminder:', error)
      await ctx.editMessageText('❌ Помилка при відправці.', getMainMenu(user.role))
    }
  })

  // Callback для скасування
  bot.action('menu_cancel', async (ctx: Context) => {
    const user = await getUser(ctx)
    await ctx.answerCbQuery('Скасовано')
    await ctx.editMessageText('Операцію скасовано.\n\nОберіть дію:', getMainMenu(user?.role || 'VIEWER'))
  })

  // Кнопка «Написати повідомлення» — дозволяє наступне текстове повідомлення, показує підказку
  bot.action('menu_write_message', async (ctx: Context) => {
    const user = await getUser(ctx)
    await ctx.answerCbQuery('✉️ Написати повідомлення')
    const chatId = ctx.chat?.id
    if (chatId) {
      const key = `${config.businessId}:${String(chatId)}`
      awaitingMessageSession.set(key, Date.now())
    }
    const msg =
      '💬 Напишіть ваше повідомлення нижче.\n\nМи отримаємо його та відповімо найближчим часом.'
    if (user && user.businessId === config.businessId) {
      await ctx.reply(msg, getMainMenu(user.role))
    } else {
      const settings = await getBotSettings(config.businessId)
      await ctx.reply(msg, getWriteMessageKeyboard(!!settings.bookingEnabled))
    }
  })

  // Кнопка «Інформація про бізнес»
  bot.action('menu_info', async (ctx: Context) => {
    const user = await getUser(ctx)
    await ctx.answerCbQuery('ℹ️ Інформація')
    const business = await prisma.business.findUnique({
      where: { id: config.businessId },
      select: { name: true, slug: true, phone: true, address: true, location: true, workingHours: true },
    })
    if (!business) {
      await ctx.reply('Інформація недоступна.')
      return
    }
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'
    const bookingUrl = business.slug ? `${baseUrl.replace(/\/$/, '')}/booking/${business.slug}` : null
    let text = `🏢 *${business.name || 'Бізнес'}*\n\n`
    if (business.address?.trim()) text += `📍 Адреса: ${business.address}\n`
    if (business.location?.trim()) text += `📍 ${business.location}\n`
    if (business.phone?.trim()) text += `📞 Телефон: ${business.phone}\n`
    if (business.workingHours?.trim()) text += `🕐 Графік: ${business.workingHours}\n`
    if (bookingUrl) text += `\n🔗 Запис онлайн: ${bookingUrl}`
    await ctx.reply(text, { parse_mode: 'Markdown' })
    if (user && user.businessId === config.businessId) {
      await ctx.reply('Оберіть дію:', getMainMenu(user.role))
    } else {
      const settings = await getBotSettings(config.businessId)
      await ctx.reply('Оберіть дію:', getWriteMessageKeyboard(!!settings.bookingEnabled))
    }
  })

  // Callback для допомоги
  bot.action('menu_help', async (ctx: Context) => {
    const user = await getUser(ctx)
    await logAction('callback', 'menu_help', null, ctx.from?.id?.toString())

    const commands = getAvailableCommands(user?.role || 'VIEWER')
    await ctx.editMessageText(
      `ℹ️ Допомога\n\nДоступні команди:\n${commands.join('\n')}\n\nВаша роль: ${getRoleName(user?.role || 'VIEWER')}\n\nОберіть дію:`,
      getMainMenu(user?.role || 'VIEWER')
    )
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
      await ctx.reply('❌ Немає доступних спеціалістів. Зв\'яжіться з адміністратором.')
      return
    }

    bookingSession.set(sessionKey, { step: 'master' })

    const buttons = masters.map((m) => [Markup.button.callback(m.name, `book_m_${m.id}`)])
    buttons.push([Markup.button.callback('❌ Скасувати', 'book_cancel')])

    await ctx.reply('👤 Оберіть спеціаліста:', Markup.inlineKeyboard(buttons))
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
      await ctx.reply(`❌ Немає вільних слотів на найближчі ${daysLabel}. Спробуйте пізніше або зв'яжіться з нами.`)
      return
    }

    const datesWithSlots = [...new Set(recommendedSlots.map((s) => s.date))].sort().slice(0, 10)

    bookingSession.set(sessionKey, {
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
    dateButtons.push([Markup.button.callback('❌ Скасувати', 'book_cancel')])

    await ctx.reply('📅 Оберіть дату:', Markup.inlineKeyboard(dateButtons))
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
      await ctx.reply('❌ На цю дату немає вільних слотів. Оберіть іншу дату.')
      return goToSlotDateStep(ctx, sessionKey, { ...state, step: 'slot_date', durationMinutes: durationMin }, durationMin)
    }

    const dateLabel = (() => {
      try {
        return format(parseISO(dateNorm + 'T12:00:00'), 'd MMMM', { locale: uk })
      } catch {
        return `${dateNorm.slice(8, 10)}.${dateNorm.slice(5, 7)}`
      }
    })()

    bookingSession.set(sessionKey, {
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
    timeButtons.push([Markup.button.callback('◀️ Інша дата', 'book_back_dates')])
    timeButtons.push([Markup.button.callback('❌ Скасувати', 'book_cancel')])

    await ctx.reply(`🕐 Оберіть час на ${dateLabel}:`, Markup.inlineKeyboard(timeButtons))
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
      bookingSession.set(sessionKey, {
        step: 'service_choice',
        masterId: master.id,
        masterName: master.name,
        durationMinutes: durationMin,
      })
      const choiceButtons = [
        [Markup.button.callback('📋 З прайсу', 'book_show_services')],
        [Markup.button.callback('⏱ Без послуги', 'book_without_svc')],
        [Markup.button.callback('❌ Скасувати', 'book_cancel')],
      ]
      await ctx.reply(
        'Оберіть варіант запису:',
        Markup.inlineKeyboard(choiceButtons)
      )
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

      bookingSession.set(sessionKey, {
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
      svcButtons.push([Markup.button.callback('❌ Скасувати', 'book_cancel')])
      await ctx.reply('📋 Оберіть послугу з прайсу:', Markup.inlineKeyboard(svcButtons))
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
    const state = bookingSession.get(sessionKey)
    if (!state || state.step !== 'service_choice' || !state.masterId) {
      await ctx.answerCbQuery('Сесію скинуто. Почніть з /start')
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
      await ctx.reply(
        'Немає послуг у прайсі. Оберіть «Без послуги»:',
        Markup.inlineKeyboard(choiceButtons)
      )
      return
    }

    bookingSession.set(sessionKey, { ...state, step: 'service' })
    const svcButtons = filtered.slice(0, 12).map((s) => [
      Markup.button.callback(`${s.name} · ${s.price} грн`, `book_svc_${s.id}`),
    ])
    svcButtons.push([Markup.button.callback('❌ Скасувати', 'book_cancel')])
    await ctx.reply('📋 Оберіть послугу з прайсу:', Markup.inlineKeyboard(svcButtons))
  })

  bot.action('book_without_svc', async (ctx: Context) => {
    const settings = await getBotSettings(config.businessId)
    if (!settings.bookingEnabled) return

    const chatId = String(ctx.chat?.id ?? '')
    const sessionKey = `${config.businessId}:${chatId}`
    const state = bookingSession.get(sessionKey)
    if (!state || !state.masterId || !state.masterName) {
      await ctx.answerCbQuery('Сесію скинуто. Почніть з /start')
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
    const state = bookingSession.get(sessionKey)
    if (!state || (state.step !== 'service' && state.step !== 'service_choice') || !state.masterId) {
      await ctx.answerCbQuery('Сесію скинуто. Почніть з /start')
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
    const state = bookingSession.get(sessionKey)
    if (!state || state.step !== 'slot_date' || !state.masterId) {
      await ctx.answerCbQuery('Сесію скинуто. Почніть з /start')
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
    const state = bookingSession.get(sessionKey)
    if (!state || (state.step !== 'slot_time' && state.step !== 'slot_date') || !state.masterId) {
      await ctx.answerCbQuery('Сесію скинуто.')
      return
    }

    await ctx.answerCbQuery('Інша дата')
    const durationMin = state.durationMinutes ?? 30
    const backState: BookingState = { ...state, step: 'slot_date', selectedDate: undefined }
    await goToSlotDateStep(ctx, sessionKey, backState, durationMin)
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
    const state = bookingSession.get(sessionKey)
    if (!state || (state.step !== 'slot' && state.step !== 'slot_time') || !state.masterId || !state.masterName) {
      await ctx.answerCbQuery('Сесію скинуто. Почніть з /start')
      return
    }

    const slot = slotRaw.replace(/_/g, ':')
    const slotLabel = slot.length >= 16 ? `${slot.slice(8, 10)}.${slot.slice(5, 7)} ${slot.slice(11, 16)}` : slot

    await ctx.answerCbQuery(slotLabel)

    const serviceInfo = state.serviceName ? `\nПослуга: ${state.serviceName}` : state.withoutService ? '\nБез послуги (консультація)' : ''

    bookingSession.set(sessionKey, {
      ...state,
      step: 'contact',
      slot,
      slotLabel,
    })

    const contactKb = Markup.keyboard([[Markup.button.contactRequest('📱 Поділитися номером')]])
      .resize()
      .oneTime()

    await ctx.reply(
      `📞 Підтвердіть запис до ${state.masterName} на ${slotLabel}${serviceInfo}\n\n` +
        `Натисніть кнопку нижче або напишіть номер (наприклад 0671234567):`,
      contactKb
    )
  })

  bot.action('book_cancel', async (ctx: Context) => {
    await ctx.answerCbQuery('Скасовано')
    const chatId = String(ctx.chat?.id ?? '')
    bookingSession.delete(`${config.businessId}:${chatId}`)
    await ctx.reply('Запис скасовано. Напишіть /start, щоб почати знову.')
  })

  bot.on('contact', async (ctx) => {
    const contact = ctx.message?.contact
    const chatId = ctx.chat?.id
    if (!contact?.phone_number || !chatId) return

    const sessionKey = `${config.businessId}:${String(chatId)}`
    const state = bookingSession.get(sessionKey)
    if (!state || state.step !== 'contact' || !state.masterId || !state.slot) {
      await ctx.reply('Сесію скинуто. Напишіть /start, щоб почати запис.')
      return
    }

    const phone = contact.phone_number.replace(/\s/g, '')
    const { normalizeUaPhone, isValidUaPhone } = await import('@/lib/utils/phone')
    const normalizedPhone = normalizeUaPhone(phone)
    if (!isValidUaPhone(normalizedPhone)) {
      await ctx.reply('❌ Невірний формат номера. Потрібен український номер (0671234567). Спробуйте ще раз.')
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

      bookingSession.delete(sessionKey)
      const removeKb = Markup.removeKeyboard()

      if (res.ok && !data.error) {
        const svcLine = state.serviceName
          ? `Послуга: ${state.serviceName}\n`
          : state.withoutService
            ? 'Без послуги (консультація)\n'
            : ''
        const managePath = data.manageUrl
        const fullManageUrl = managePath
          ? `${baseUrl.replace(/\/$/, '')}${managePath.startsWith('/') ? '' : '/'}${managePath}`
          : null
        const manageBlock =
          fullManageUrl
            ? `\n\n🔗 Збережіть посилання — ним можна перенести або скасувати запис (лише після підтвердження майстра в кабінеті):\n${fullManageUrl}`
            : ''
        await ctx.reply(
          `✅ Запис створено!\n\n` +
            `Спеціаліст: ${state.masterName}\n` +
            `Дата та час: ${state.slotLabel}\n` +
            svcLine +
            `\nМи підтвердимо запис найближчим часом.` +
            manageBlock,
          removeKb
        )
      } else {
        const errMsg = data?.error || data?.message || 'Не вдалося створити запис.'
        await ctx.reply(`❌ ${errMsg}\n\nСпробуйте інший час або зв'яжіться з нами.`, removeKb)
      }
    } catch (err: unknown) {
      bookingSession.delete(sessionKey)
      await ctx.reply('❌ Помилка з\'єднання. Спробуйте пізніше.', Markup.removeKeyboard())
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
    const bookingState = bookingSession.get(sessionKey)
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
        '💬 Щоб надіслати повідомлення, натисніть кнопку «✉️ Написати повідомлення» нижче.'
      await ctx.reply(denyMsg, getWriteMessageKeyboard(!!settings.bookingEnabled))
      return
    }

    if (isAwaitingMessage) {
      awaitingMessageSession.delete(sessionKey)
    }

    const senderName = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || `ID ${from.id}`

    try {
      // Якщо це крок контакту в записі — обробляємо телефон, не зберігаємо як повідомлення
      if (isBookingContactStep && bookingState) {
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
            bookingSession.delete(sessionKey)

            if (res.ok && !data.error) {
              const svcLine = bookingState.serviceName
                ? `Послуга: ${bookingState.serviceName}\n`
                : bookingState.withoutService
                  ? 'Без послуги (консультація)\n'
                  : ''
              const managePath = data.manageUrl
              const fullManageUrl = managePath
                ? `${baseUrl.replace(/\/$/, '')}${managePath.startsWith('/') ? '' : '/'}${managePath}`
                : null
              const manageBlock =
                fullManageUrl
                  ? `\n\n🔗 Збережіть посилання — ним можна перенести або скасувати запис (лише після підтвердження майстра в кабінеті):\n${fullManageUrl}`
                  : ''
              await ctx.reply(
                `✅ Запис створено!\n\n` +
                  `Спеціаліст: ${bookingState.masterName}\n` +
                  `Дата та час: ${bookingState.slotLabel}\n` +
                  svcLine +
                  `\nМи підтвердимо запис найближчим часом.` +
                  manageBlock,
                Markup.removeKeyboard()
              )
            } else {
              const errMsg = data?.error || data?.message || 'Не вдалося створити запис.'
              await ctx.reply(`❌ ${errMsg}\n\nСпробуйте інший час або зв'яжіться з нами.`, Markup.removeKeyboard())
            }
          } catch (err: unknown) {
            bookingSession.delete(sessionKey)
            await ctx.reply('❌ Помилка з\'єднання. Спробуйте пізніше.', Markup.removeKeyboard())
            console.error('Telegram booking error:', err)
          }
          return
        }
        await ctx.reply('❌ Невірний формат номера. Введіть український номер, наприклад 0671234567')
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
      await ctx.reply(autoReply, getWriteMessageKeyboard(!!settings.bookingEnabled))
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

