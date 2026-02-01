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
      `Відправте повідомлення у форматі:\n` +
      `Назва: <назва розсилки>\n` +
      `Текст: <текст повідомлення>\n\n` +
      `Або використайте команду:\n` +
      `/broadcast_create\n\n` +
      `Для скасування: /cancel`
    )
  })

  // Обробка помилок
  bot.catch((err, ctx) => {
    console.error('Telegram bot error:', err)
    ctx.reply('❌ Сталася помилка. Спробуйте пізніше.')
  })

  return bot
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

