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

  // Головне меню з кнопками (спрощене - тільки сповіщення)
  const getMainMenu = (role: string) => {
    const buttons: any[] = []

    // Тільки сповіщення та нагадування
    if (hasPermission(role, 'create_broadcast')) {
      buttons.push([Markup.button.callback('⏰ Створити нагадування', 'menu_reminder_create')])
      buttons.push([Markup.button.callback('📝 Мої нагадування', 'menu_reminders')])
    }

    buttons.push([Markup.button.callback('ℹ️ Допомога', 'menu_help')])

    return Markup.inlineKeyboard(buttons)
  }

  // Обробка кодів підтвердження (6-значні числа)
  bot.hears(/^\d{6}$/, async (ctx: Context) => {
    try {
      const code = ctx.message && 'text' in ctx.message ? ctx.message.text : ''
      const telegramId = BigInt(ctx.from?.id || 0)

      // Перевіряємо чи це код підтвердження
      const { verifyCode } = await import('./utils/telegram-verification')
      const verification = await verifyCode(code)

      if (!verification.success || !verification.verification) {
        await ctx.reply(`❌ ${verification.error || 'Невірний код підтвердження'}`)
        return
      }

      const ver = verification.verification

      // Перевіряємо чи код належить цьому користувачу
      if (ver.telegramId !== telegramId) {
        await ctx.reply('❌ Цей код не належить вам.')
        return
      }

      // Виконуємо вхід/реєстрацію через API
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'
      const response = await fetch(`${baseUrl}/api/auth/telegram-oauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationCode: code
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const actionText = ver.action === 'login' ? 'вхід' : 'реєстрацію'
        await ctx.reply(`✅ ${actionText === 'вхід' ? 'Вхід' : 'Реєстрацію'} успішно завершено!\n\nТепер ви можете використовувати систему.`)
      } else {
        await ctx.reply(`❌ Помилка при ${ver.action === 'login' ? 'вході' : 'реєстрації'}: ${data.error || 'Невідома помилка'}`)
      }
    } catch (error: any) {
      console.error('Error processing verification code:', error)
      await ctx.reply('❌ Помилка обробки коду підтвердження.')
    }
  })

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
          `Ви отримуватимете сповіщення про нові записи та нагадування.\n\n` +
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
        `Ви отримуватимете сповіщення про нові записи та нагадування.\n\n` +
        `Оберіть дію:`,
        getMainMenu(userWithPassword.role)
      )
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

  const commands: string[] = ['/start - Початок роботи / активація']

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

