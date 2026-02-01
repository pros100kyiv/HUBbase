import { Telegraf, Context, Markup } from 'telegraf'
import { prisma } from './prisma'

// Функція форматування валюти
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100)
}

interface TelegramBotConfig {
  token: string
  businessId: string
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

  // Перевірка прав доступу
  const hasPermission = (role: string, permission: string): boolean => {
    const permissions: Record<string, string[]> = {
      DEVELOPER: ['*'], // Всі права
      OWNER: ['view_stats', 'view_revenue', 'view_alerts', 'manage_users', 'manage_settings', 'create_broadcast', 'send_broadcast'],
      ADMIN: ['view_stats', 'view_revenue', 'view_alerts', 'manage_users', 'create_broadcast', 'send_broadcast'],
      MANAGER: ['view_stats', 'view_revenue', 'view_alerts', 'create_broadcast'],
      EMPLOYEE: ['view_stats'],
      CLIENT: ['receive_broadcast'], // Тільки отримувати розсилки
      VIEWER: [],
    }

    const rolePermissions = permissions[role] || []
    return rolePermissions.includes('*') || rolePermissions.includes(permission)
  }

  // Головне меню з кнопками
  const getMainMenu = (role: string) => {
    const buttons: any[] = []

    if (hasPermission(role, 'view_stats')) {
      buttons.push([Markup.button.callback('📊 Статистика', 'menu_stats')])
    }

    if (hasPermission(role, 'view_revenue')) {
      buttons.push([Markup.button.callback('💰 Аналітика прибутку', 'menu_revenue')])
    }

    if (hasPermission(role, 'view_alerts')) {
      buttons.push([Markup.button.callback('⚠️ Сповіщення', 'menu_alerts')])
    }

    if (hasPermission(role, 'create_broadcast')) {
      buttons.push([Markup.button.callback('📢 Створити розсилку', 'menu_broadcast_create')])
      buttons.push([Markup.button.callback('📋 Мої розсилки', 'menu_broadcasts')])
    }

    if (hasPermission(role, 'create_broadcast')) {
      buttons.push([Markup.button.callback('⏰ Створити нагадування', 'menu_reminder_create')])
      buttons.push([Markup.button.callback('📝 Мої нагадування', 'menu_reminders')])
    }

    if (hasPermission(role, 'manage_users')) {
      buttons.push([Markup.button.callback('👥 Користувачі', 'menu_users')])
    }

    if (hasPermission(role, '*')) {
      buttons.push([Markup.button.callback('🔧 Моніторинг', 'menu_monitor')])
    }

    buttons.push([Markup.button.callback('ℹ️ Допомога', 'menu_help')])

    return Markup.inlineKeyboard(buttons)
  }

  // Команда /start - активація через пароль
  bot.command('start', async (ctx: Context) => {
    try {
      const telegramId = BigInt(ctx.from?.id || 0)
      const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : ''
      const args = messageText ? messageText.split(' ') : []
      const password = args[1] // Пароль з команди /start <password>

      await logAction('command', 'start', password || null, ctx.from?.id?.toString())

      // Перевіряємо чи користувач вже зареєстрований
      let telegramUser = await prisma.telegramUser.findUnique({
        where: { telegramId },
      })

      if (telegramUser) {
        // Користувач вже зареєстрований
        if (telegramUser.businessId !== config.businessId) {
          await ctx.reply('❌ Ви не маєте доступу до цього бота.')
          return
        }

        // Оновлюємо дані
        await prisma.telegramUser.update({
          where: { id: telegramUser.id },
          data: {
            username: ctx.from?.username,
            firstName: ctx.from?.first_name,
            lastName: ctx.from?.last_name,
            lastActivity: new Date(),
          },
        })

        await ctx.reply(
          `✅ Вітаємо, ${ctx.from?.first_name || 'користувач'}!\n\n` +
          `Ваша роль: ${getRoleName(telegramUser.role)}\n\n` +
          `Оберіть дію:`,
          getMainMenu(telegramUser.role)
        )
        return
      }

      // Новий користувач - потрібна активація
      if (!password) {
        await ctx.reply(
          `🔐 Для активації бота потрібен пароль.\n\n` +
          `Отримайте пароль активації в особистому кабінеті бізнесу:\n` +
          `Налаштування → Telegram → Генерувати пароль\n\n` +
          `Потім використайте команду:\n` +
          `/start <пароль>`
        )
        return
      }

      // Шукаємо користувача з таким паролем активації
      const userWithPassword = await prisma.telegramUser.findFirst({
        where: {
          businessId: config.businessId,
          activationPassword: password,
          activatedAt: null, // Ще не активований
        },
      })

      if (!userWithPassword) {
        await ctx.reply('❌ Невірний пароль активації. Перевірте пароль та спробуйте знову.')
        return
      }

      // Активуємо користувача
      await prisma.telegramUser.update({
        where: { id: userWithPassword.id },
        data: {
          telegramId,
          username: ctx.from?.username,
          firstName: ctx.from?.first_name,
          lastName: ctx.from?.last_name,
          activatedAt: new Date(),
          activationPassword: null, // Видаляємо пароль після активації
          lastActivity: new Date(),
        },
      })

      await ctx.reply(
        `✅ Активація успішна!\n\n` +
        `Вітаємо, ${ctx.from?.first_name || 'користувач'}!\n` +
        `Ваша роль: ${getRoleName(userWithPassword.role)}\n\n` +
        `Оберіть дію:`,
        getMainMenu(userWithPassword.role)
      )
    } catch (error) {
      console.error('Error in /start command:', error)
      await ctx.reply('❌ Помилка при обробці команди.')
    }
  })

  // Callback для головного меню
  bot.action('menu_stats', async (ctx: Context) => {
    const user = await getUser(ctx)
    if (!user || !hasPermission(user.role, 'view_stats')) {
      await ctx.answerCbQuery('❌ У вас немає прав для перегляду статистики.')
      return
    }

    await logAction('callback', 'menu_stats', null, ctx.from?.id?.toString())

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const stats = await fetch(`${baseUrl}/api/statistics?businessId=${config.businessId}&period=month`)
      .then(res => res.json())
      .catch(() => null)

    if (!stats) {
      await ctx.answerCbQuery('❌ Не вдалося завантажити статистику.')
      return
    }

    await ctx.editMessageText(
      `📊 Статистика за місяць:\n\n` +
      `📅 Всього візитів: ${stats.totalAppointments || 0}\n` +
      `✅ Завершено: ${stats.completedAppointments || 0}\n` +
      `⏳ Підтверджено: ${stats.confirmedAppointments || 0}\n` +
      `❌ Скасовано: ${stats.cancelledAppointments || 0}\n` +
      `💰 Дохід: ${formatCurrency(stats.totalRevenue || 0)}\n` +
      `👥 Клієнтів: ${stats.uniqueClients || 0}\n\n` +
      `Оберіть дію:`,
      getMainMenu(user.role)
    )
  })

  // Callback для аналітики прибутку
  bot.action('menu_revenue', async (ctx: Context) => {
    const user = await getUser(ctx)
    if (!user || !hasPermission(user.role, 'view_revenue')) {
      await ctx.answerCbQuery('❌ У вас немає прав для перегляду аналітики.')
      return
    }

    await logAction('callback', 'menu_revenue', null, ctx.from?.id?.toString())

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const revenue = await fetch(`${baseUrl}/api/analytics/revenue?businessId=${config.businessId}&period=month`)
      .then(res => res.json())
      .catch(() => null)

    if (!revenue) {
      await ctx.answerCbQuery('❌ Не вдалося завантажити аналітику.')
      return
    }

    const trendIcon = revenue.revenueChange > 0 ? '📈' : revenue.revenueChange < 0 ? '📉' : '➡️'

    await ctx.editMessageText(
      `💰 Аналітика прибутку:\n\n` +
      `💵 Поточний прибуток: ${formatCurrency(revenue.currentRevenue || 0)}\n` +
      `${trendIcon} Зміна: ${revenue.revenueChange > 0 ? '+' : ''}${revenue.revenueChange?.toFixed(1) || 0}%\n\n` +
      `🔮 Прогнозований прибуток: ${formatCurrency(revenue.forecastedRevenue || 0)}\n\n` +
      `📋 Топ послуги:\n${revenue.serviceAnalytics?.slice(0, 5).map((s: any, i: number) => 
        `${i + 1}. ${s.serviceName}: ${formatCurrency(s.revenue)}`
      ).join('\n') || 'Немає даних'}\n\n` +
      `Оберіть дію:`,
      getMainMenu(user.role)
    )
  })

  // Callback для сповіщень
  bot.action('menu_alerts', async (ctx: Context) => {
    const user = await getUser(ctx)
    if (!user || !hasPermission(user.role, 'view_alerts')) {
      await ctx.answerCbQuery('❌ У вас немає прав для перегляду сповіщень.')
      return
    }

    await logAction('callback', 'menu_alerts', null, ctx.from?.id?.toString())

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const alertsData = await fetch(`${baseUrl}/api/analytics/alerts?businessId=${config.businessId}`)
      .then(res => res.json())
      .catch(() => ({ alerts: [] }))

    if (!alertsData.alerts || alertsData.alerts.length === 0) {
      await ctx.editMessageText(
        '✅ Немає активних сповіщень.\n\nОберіть дію:',
        getMainMenu(user.role)
      )
      return
    }

    const alertsText = alertsData.alerts.map((alert: any, i: number) => {
      const icon = alert.type === 'critical' ? '🔴' : alert.type === 'warning' ? '🟡' : '🔵'
      return `${icon} ${i + 1}. ${alert.message}\n   Зміна: ${alert.change > 0 ? '+' : ''}${alert.change.toFixed(1)}%`
    }).join('\n\n')

    await ctx.editMessageText(
      `⚠️ Активні сповіщення:\n\n${alertsText}\n\nОберіть дію:`,
      getMainMenu(user.role)
    )
  })

  // Callback для створення розсилки
  bot.action('menu_broadcast_create', async (ctx: Context) => {
    const user = await getUser(ctx)
    if (!user || !hasPermission(user.role, 'create_broadcast')) {
      await ctx.answerCbQuery('❌ У вас немає прав для створення розсилок.')
      return
    }

    await ctx.answerCbQuery('📢 Створення розсилки')
    await ctx.reply(
      `📢 Створення розсилки\n\n` +
      `Для створення розсилки використайте веб-інтерфейс:\n` +
      `Налаштування → Telegram → Розсилки\n\n` +
      `Або поверніться до головного меню:`,
      getMainMenu(user.role)
    )
  })

  // Callback для списку розсилок
  bot.action('menu_broadcasts', async (ctx: Context) => {
    const user = await getUser(ctx)
    if (!user || !hasPermission(user.role, 'create_broadcast')) {
      await ctx.answerCbQuery('❌ У вас немає прав для перегляду розсилок.')
      return
    }

    await logAction('callback', 'menu_broadcasts', null, ctx.from?.id?.toString())

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const broadcasts = await fetch(`${baseUrl}/api/telegram/broadcasts?businessId=${config.businessId}`)
      .then(res => res.json())
      .catch(() => [])

    if (!broadcasts || broadcasts.length === 0) {
      await ctx.editMessageText(
        '📋 Немає створених розсилок.\n\nОберіть дію:',
        getMainMenu(user.role)
      )
      return
    }

    const broadcastsText = broadcasts.slice(0, 5).map((b: any, i: number) => {
      const statusIcon = b.status === 'sent' ? '✅' : b.status === 'scheduled' ? '⏰' : '📝'
      return `${statusIcon} ${i + 1}. ${b.title}\n   Статус: ${b.status === 'draft' ? 'Чернетка' : b.status === 'sent' ? 'Відправлено' : 'Заплановано'}`
    }).join('\n\n')

    await ctx.editMessageText(
      `📋 Мої розсилки:\n\n${broadcastsText}\n\nОберіть дію:`,
      getMainMenu(user.role)
    )
  })

  // Callback для користувачів
  bot.action('menu_users', async (ctx: Context) => {
    const user = await getUser(ctx)
    if (!user || !hasPermission(user.role, 'manage_users')) {
      await ctx.answerCbQuery('❌ У вас немає прав для перегляду користувачів.')
      return
    }

    await logAction('callback', 'menu_users', null, ctx.from?.id?.toString())

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const users = await fetch(`${baseUrl}/api/telegram/users?businessId=${config.businessId}`)
      .then(res => res.json())
      .catch(() => [])

    if (!users || users.length === 0) {
      await ctx.editMessageText(
        '👥 Немає зареєстрованих користувачів.\n\nОберіть дію:',
        getMainMenu(user.role)
      )
      return
    }

    const usersText = users.slice(0, 10).map((u: any, i: number) => {
      return `${i + 1}. ${u.firstName || ''} ${u.lastName || ''} (${getRoleName(u.role)})`
    }).join('\n')

    await ctx.editMessageText(
      `👥 Користувачі бота:\n\n${usersText}\n\nОберіть дію:`,
      getMainMenu(user.role)
    )
  })

  // Callback для моніторингу (розробник)
  bot.action('menu_monitor', async (ctx: Context) => {
    const user = await getUser(ctx)
    if (!user || !hasPermission(user.role, '*')) {
      await ctx.answerCbQuery('❌ У вас немає прав для моніторингу.')
      return
    }

    await logAction('callback', 'menu_monitor', null, ctx.from?.id?.toString())

    const logs = await prisma.telegramLog.findMany({
      where: { businessId: config.businessId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const logsText = logs.map((log, i) => {
      return `${i + 1}. [${log.action}] ${log.command || log.message || 'N/A'}`
    }).join('\n')

    await ctx.editMessageText(
      `🔧 Останні дії:\n\n${logsText || 'Немає логів'}\n\nОберіть дію:`,
      getMainMenu(user.role)
    )
  })

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

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
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
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
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
        await ctx.reply('❌ Помилка при створенні нагадування.')
      }
    } catch (error) {
      console.error('Error creating reminder:', error)
      await ctx.reply('❌ Помилка при створенні нагадування.')
    }
  })

  // Callback для відправки нагадування
  bot.action(/^send_reminder_(.+)$/, async (ctx: Context) => {
    const user = await getUser(ctx)
    if (!user || !hasPermission(user.role, 'create_broadcast')) {
      await ctx.answerCbQuery('❌ У вас немає прав.')
      return
    }

    const callbackData = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
    const reminderId = callbackData.replace('send_reminder_', '')
    await ctx.answerCbQuery('⏰ Відправка нагадування...')

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
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
    OWNER: ['view_stats', 'view_revenue', 'view_alerts', 'manage_users', 'manage_settings', 'create_broadcast', 'send_broadcast'],
    ADMIN: ['view_stats', 'view_revenue', 'view_alerts', 'manage_users', 'create_broadcast', 'send_broadcast'],
    MANAGER: ['view_stats', 'view_revenue', 'view_alerts', 'create_broadcast'],
    EMPLOYEE: ['view_stats'],
    CLIENT: ['receive_broadcast'],
    VIEWER: [],
  }

  const rolePermissions = permissions[role] || []
  const hasPermission = (perm: string) => rolePermissions.includes('*') || rolePermissions.includes(perm)

  const commands: string[] = ['/start - Початок роботи']

  if (hasPermission('view_stats')) {
    commands.push('📊 Статистика - через меню')
  }

  if (hasPermission('view_revenue')) {
    commands.push('💰 Аналітика прибутку - через меню')
  }

  if (hasPermission('view_alerts')) {
    commands.push('⚠️ Сповіщення - через меню')
  }

  if (hasPermission('create_broadcast')) {
    commands.push('📢 Створення розсилок - через веб-інтерфейс')
  }

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

