import { Telegraf, Context } from 'telegraf'
import { prisma } from './prisma'
// Функція форматування валюти
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100) // Конвертуємо з копійок
}

interface TelegramBotConfig {
  token: string
  businessId: string
}

interface RevenueAlert {
  type: 'warning' | 'critical' | 'info'
  message: string
  value: number
  previousValue: number
  change: number
}

/**
 * Створює та налаштовує Telegram бота для бізнесу
 */
export function createTelegramBot(config: TelegramBotConfig) {
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

  // Команда /start - реєстрація/вхід
  bot.command('start', async (ctx: Context) => {
    try {
      const telegramId = BigInt(ctx.from?.id || 0)
      const username = ctx.from?.username
      const firstName = ctx.from?.first_name
      const lastName = ctx.from?.last_name

      await logAction('command', 'start', null, ctx.from?.id?.toString())

      // Перевіряємо чи користувач вже зареєстрований
      let telegramUser = await prisma.telegramUser.findUnique({
        where: { telegramId },
        include: { business: true },
      })

      if (!telegramUser) {
        // Новий користувач - пропонуємо реєстрацію
        await ctx.reply(
          `👋 Вітаємо! Ви не зареєстровані в системі.\n\n` +
          `Для реєстрації зверніться до адміністратора бізнесу або використайте команду /register`
        )
        return
      }

      // Перевіряємо чи користувач належить до цього бізнесу
      if (telegramUser.businessId !== config.businessId) {
        await ctx.reply('❌ Ви не маєте доступу до цього бота.')
        return
      }

      // Оновлюємо дані користувача
      await prisma.telegramUser.update({
        where: { id: telegramUser.id },
        data: {
          username,
          firstName,
          lastName,
          lastActivity: new Date(),
        },
      })

      await ctx.reply(
        `✅ Вітаємо, ${firstName || 'користувач'}!\n\n` +
        `Ваша роль: ${getRoleName(telegramUser.role)}\n\n` +
        `Використайте /help для списку команд.`
      )
    } catch (error) {
      console.error('Error in /start command:', error)
      await ctx.reply('❌ Помилка при обробці команди.')
    }
  })

  // Команда /help - список команд
  bot.command('help', async (ctx: Context) => {
    try {
      const telegramId = BigInt(ctx.from?.id || 0)
      const user = await prisma.telegramUser.findUnique({
        where: { telegramId },
      })

      if (!user || user.businessId !== config.businessId) {
        await ctx.reply('❌ Ви не маєте доступу до цього бота.')
        return
      }

      await logAction('command', 'help', null, ctx.from?.id?.toString())

      const commands = getAvailableCommands(user.role)
      await ctx.reply(
        `📋 Доступні команди:\n\n${commands.join('\n')}\n\n` +
        `Ваша роль: ${getRoleName(user.role)}`
      )
    } catch (error) {
      console.error('Error in /help command:', error)
      await ctx.reply('❌ Помилка при обробці команди.')
    }
  })

  // Команда /stats - статистика
  bot.command('stats', async (ctx: Context) => {
    try {
      const telegramId = BigInt(ctx.from?.id || 0)
      const user = await prisma.telegramUser.findUnique({
        where: { telegramId },
      })

      if (!user || user.businessId !== config.businessId) {
        await ctx.reply('❌ Ви не маєте доступу до цього бота.')
        return
      }

      if (!hasPermission(user.role, 'view_stats')) {
        await ctx.reply('❌ У вас немає прав для перегляду статистики.')
        return
      }

      await logAction('command', 'stats', null, ctx.from?.id?.toString())

      // Завантажуємо статистику
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      const stats = await fetch(`${baseUrl}/api/statistics?businessId=${config.businessId}&period=month`)
        .then(res => res.json())
        .catch(() => null)

      if (!stats) {
        await ctx.reply('❌ Не вдалося завантажити статистику.')
        return
      }

      await ctx.reply(
        `📊 Статистика за місяць:\n\n` +
        `📅 Всього візитів: ${stats.totalAppointments || 0}\n` +
        `✅ Завершено: ${stats.completedAppointments || 0}\n` +
        `⏳ Підтверджено: ${stats.confirmedAppointments || 0}\n` +
        `❌ Скасовано: ${stats.cancelledAppointments || 0}\n` +
        `💰 Дохід: ${formatCurrency(stats.totalRevenue || 0)}\n` +
        `👥 Клієнтів: ${stats.uniqueClients || 0}`
      )
    } catch (error) {
      console.error('Error in /stats command:', error)
      await ctx.reply('❌ Помилка при обробці команди.')
    }
  })

  // Команда /revenue - аналітика прибутку
  bot.command('revenue', async (ctx: Context) => {
    try {
      const telegramId = BigInt(ctx.from?.id || 0)
      const user = await prisma.telegramUser.findUnique({
        where: { telegramId },
      })

      if (!user || user.businessId !== config.businessId) {
        await ctx.reply('❌ Ви не маєте доступу до цього бота.')
        return
      }

      if (!hasPermission(user.role, 'view_revenue')) {
        await ctx.reply('❌ У вас немає прав для перегляду аналітики прибутку.')
        return
      }

      await logAction('command', 'revenue', null, ctx.from?.id?.toString())

      // Завантажуємо аналітику прибутку
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      const revenue = await fetch(`${baseUrl}/api/analytics/revenue?businessId=${config.businessId}&period=month`)
        .then(res => res.json())
        .catch(() => null)

      if (!revenue) {
        await ctx.reply('❌ Не вдалося завантажити аналітику прибутку.')
        return
      }

      const trendIcon = revenue.trends?.currentRevenueChange > 0 ? '📈' : revenue.trends?.currentRevenueChange < 0 ? '📉' : '➡️'
      const forecastTrendIcon = revenue.trends?.forecastedRevenueChange > 0 ? '📈' : revenue.trends?.forecastedRevenueChange < 0 ? '📉' : '➡️'

      await ctx.reply(
        `💰 Аналітика прибутку:\n\n` +
        `💵 Поточний прибуток: ${formatCurrency(revenue.currentRevenue || 0)}\n` +
        `${trendIcon} Зміна: ${revenue.trends?.currentRevenueChange > 0 ? '+' : ''}${revenue.trends?.currentRevenueChange?.toFixed(1) || 0}%\n\n` +
        `🔮 Прогнозований прибуток: ${formatCurrency(revenue.forecastedRevenue || 0)}\n` +
        `${forecastTrendIcon} Зміна: ${revenue.trends?.forecastedRevenueChange > 0 ? '+' : ''}${revenue.trends?.forecastedRevenueChange?.toFixed(1) || 0}%\n\n` +
        `📋 Топ послуги:\n${revenue.revenueByService?.slice(0, 5).map((s: any, i: number) => 
          `${i + 1}. ${s.serviceName}: ${formatCurrency(s.revenue)}`
        ).join('\n') || 'Немає даних'}`
      )
    } catch (error) {
      console.error('Error in /revenue command:', error)
      await ctx.reply('❌ Помилка при обробці команди.')
    }
  })

  // Команда /alerts - сповіщення
  bot.command('alerts', async (ctx: Context) => {
    try {
      const telegramId = BigInt(ctx.from?.id || 0)
      const user = await prisma.telegramUser.findUnique({
        where: { telegramId },
      })

      if (!user || user.businessId !== config.businessId) {
        await ctx.reply('❌ Ви не маєте доступу до цього бота.')
        return
      }

      if (!hasPermission(user.role, 'view_alerts')) {
        await ctx.reply('❌ У вас немає прав для перегляду сповіщень.')
        return
      }

      await logAction('command', 'alerts', null, ctx.from?.id?.toString())

      // Завантажуємо сповіщення
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      const alertsData = await fetch(`${baseUrl}/api/analytics/alerts?businessId=${config.businessId}`)
        .then(res => res.json())
        .catch(() => ({ alerts: [] }))

      if (!alertsData.alerts || alertsData.alerts.length === 0) {
        await ctx.reply('✅ Немає активних сповіщень.')
        return
      }

      const alertsText = alertsData.alerts.map((alert: RevenueAlert, i: number) => {
        const icon = alert.type === 'critical' ? '🔴' : alert.type === 'warning' ? '🟡' : '🔵'
        return `${icon} ${i + 1}. ${alert.message}\n   Зміна: ${alert.change > 0 ? '+' : ''}${alert.change.toFixed(1)}%`
      }).join('\n\n')

      await ctx.reply(`⚠️ Активні сповіщення:\n\n${alertsText}`)
    } catch (error) {
      console.error('Error in /alerts command:', error)
      await ctx.reply('❌ Помилка при обробці команди.')
    }
  })

  // Обробка помилок
  bot.catch((err, ctx) => {
    console.error('Telegram bot error:', err)
    ctx.reply('❌ Сталася помилка. Спробуйте пізніше.')
  })

  return bot
}

/**
 * Отримує назву ролі українською
 */
function getRoleName(role: string): string {
  const roles: Record<string, string> = {
    OWNER: 'Власник',
    ADMIN: 'Адміністратор',
    MANAGER: 'Менеджер',
    EMPLOYEE: 'Співробітник',
    VIEWER: 'Переглядач',
  }
  return roles[role] || role
}

/**
 * Перевіряє чи має користувач право на дію
 */
function hasPermission(role: string, permission: string): boolean {
  const permissions: Record<string, string[]> = {
    OWNER: ['view_stats', 'view_revenue', 'view_alerts', 'manage_users', 'manage_settings'],
    ADMIN: ['view_stats', 'view_revenue', 'view_alerts', 'manage_users'],
    MANAGER: ['view_stats', 'view_revenue', 'view_alerts'],
    EMPLOYEE: ['view_stats'],
    VIEWER: [],
  }

  return permissions[role]?.includes(permission) || false
}

/**
 * Отримує список доступних команд для ролі
 */
function getAvailableCommands(role: string): string[] {
  const commands: string[] = ['/start - Початок роботи', '/help - Допомога']

  if (hasPermission(role, 'view_stats')) {
    commands.push('/stats - Статистика')
  }

  if (hasPermission(role, 'view_revenue')) {
    commands.push('/revenue - Аналітика прибутку')
  }

  if (hasPermission(role, 'view_alerts')) {
    commands.push('/alerts - Сповіщення')
  }

  return commands
}

/**
 * Відправляє сповіщення користувачам бізнесу
 */
export async function sendTelegramNotification(
  businessId: string,
  message: string,
  options?: { onlyToRole?: string; excludeRole?: string }
) {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { telegramBotToken: true, telegramNotificationsEnabled: true },
    })

    if (!business?.telegramBotToken || !business.telegramNotificationsEnabled) {
      return
    }

    const bot = new Telegraf(business.telegramBotToken)

    const where: any = {
      businessId,
      isActive: true,
      notificationsEnabled: true,
    }

    if (options?.onlyToRole) {
      where.role = options.onlyToRole
    }

    if (options?.excludeRole) {
      where.role = { not: options.excludeRole }
    }

    const users = await prisma.telegramUser.findMany({
      where,
      select: { telegramId: true },
    })

    for (const user of users) {
      try {
        await bot.telegram.sendMessage(Number(user.telegramId), message, { parse_mode: 'HTML' })
      } catch (error) {
        console.error(`Error sending message to user ${user.telegramId}:`, error)
      }
    }
  } catch (error) {
    console.error('Error sending Telegram notification:', error)
  }
}

