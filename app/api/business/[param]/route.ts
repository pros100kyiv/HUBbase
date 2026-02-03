import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BusinessNiche } from '@prisma/client'

// Перевіряє чи параметр є UUID (ID) чи slug
// CUID має формат: c[0-9a-z]{24} або схожий
function isUUID(str: string): boolean {
  if (!str || typeof str !== 'string') return false
  
  // Перевіряємо UUID формат
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(str)) return true
  
  // Перевіряємо CUID формат (використовується Prisma за замовчуванням)
  const cuidRegex = /^c[0-9a-z]{24}$/i
  if (cuidRegex.test(str)) return true
  
  // Якщо це не UUID і не CUID, але має достатню довжину і не схоже на slug - вважаємо ID
  // Slug зазвичай має дефіси та малі літери
  const isSlugLike = str.includes('-') || str.includes('_') || /[A-Z]/.test(str)
  return str.length > 10 && !isSlugLike
}

const businessSelect = {
  id: true,
  name: true,
  slug: true,
  email: true,
  phone: true,
  address: true,
  description: true,
  logo: true,
  primaryColor: true,
  secondaryColor: true,
  backgroundColor: true,
  surfaceColor: true,
  hideRevenue: true,
  isActive: true,
  businessCardBackgroundImage: true,
  slogan: true,
  additionalInfo: true,
  socialMedia: true,
  workingHours: true,
  location: true,
  niche: true,
  customNiche: true,
  businessIdentifier: true,
  profileCompleted: true,
  avatar: true,
  telegramChatId: true,
  telegramId: true,
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ param: string }> | { param: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const { param } = resolvedParams

    let business

    // Якщо це UUID, шукаємо по ID
    if (isUUID(param)) {
      business = await prisma.business.findUnique({
        where: { id: param },
        select: businessSelect,
      })
    } else {
      // Інакше шукаємо по slug
      business = await prisma.business.findUnique({
        where: { slug: param },
        select: businessSelect,
      })
    }

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    return NextResponse.json({ business })
  } catch (error) {
    console.error('Error fetching business:', error)
    return NextResponse.json({ error: 'Failed to fetch business' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ param: string }> | { param: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const { param } = resolvedParams

    console.log('PATCH request received with param:', param)
    console.log('Is UUID?', isUUID(param))

    // PATCH тільки для ID (CUID або UUID)
    // Але якщо це не UUID, спробуємо знайти по slug і використати його ID
    let businessId = param
    if (!isUUID(param)) {
      console.log('Param is not UUID, trying to find by slug:', param)
      try {
        const businessBySlug = await prisma.business.findUnique({
          where: { slug: param },
          select: { id: true }
        })
        if (businessBySlug) {
          businessId = businessBySlug.id
          console.log('Found business by slug, using ID:', businessId)
        } else {
          console.error('Business not found by slug:', param)
          return NextResponse.json({ 
            error: 'Бізнес не знайдено. Будь ласка, увійдіть знову.' 
          }, { status: 404 })
        }
      } catch (slugError) {
        console.error('Error finding business by slug:', slugError)
        return NextResponse.json({ 
          error: 'Невірний формат ідентифікатора бізнесу. Будь ласка, увійдіть знову.' 
        }, { status: 400 })
      }
    }

    const body = await request.json()
    const { 
      name, 
      email, 
      phone, 
      address, 
      description, 
      primaryColor, 
      secondaryColor, 
      backgroundColor, 
      surfaceColor, 
      hideRevenue,
      businessCardBackgroundImage,
      slogan,
      additionalInfo,
      socialMedia,
      workingHours,
      location,
      // Профіль
      niche,
      customNiche,
      businessIdentifier,
      profileCompleted,
      // AI Chat
      aiChatEnabled,
      aiProvider,
      aiApiKey,
      aiSettings,
      // SMS
      smsProvider,
      smsApiKey,
      smsSender,
      // Email
      emailProvider,
      emailApiKey,
      emailFrom,
      emailFromName,
      // Payment
      paymentProvider,
      paymentApiKey,
      paymentMerchantId,
      paymentEnabled,
      // Reminders
      remindersEnabled,
      reminderSmsEnabled,
      reminderEmailEnabled,
    } = body

    // Отримуємо поточний бізнес для порівняння телефону
    let currentBusiness
    try {
      currentBusiness = await prisma.business.findUnique({
        where: { id: businessId },
        select: { phone: true, name: true },
      })

      if (!currentBusiness) {
        console.error('Business not found:', businessId)
        return NextResponse.json({ 
          error: 'Бізнес не знайдено. Будь ласка, увійдіть знову.' 
        }, { status: 404 })
      }
    } catch (error) {
      console.error('Error fetching current business:', error)
      return NextResponse.json({ 
        error: 'Помилка при отриманні даних бізнесу. Будь ласка, спробуйте ще раз.' 
      }, { status: 500 })
    }

    let business
    try {
      business = await prisma.business.update({
        where: { id: businessId },
        data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(address !== undefined && { address: address || null }),
        ...(description !== undefined && { description: description || null }),
        ...(primaryColor !== undefined && { primaryColor }),
        ...(secondaryColor !== undefined && { secondaryColor }),
        ...(backgroundColor !== undefined && { backgroundColor }),
        ...(surfaceColor !== undefined && { surfaceColor }),
        ...(hideRevenue !== undefined && { hideRevenue }),
        ...(businessCardBackgroundImage !== undefined && { businessCardBackgroundImage: businessCardBackgroundImage || null }),
        ...(slogan !== undefined && { slogan: slogan || null }),
        ...(additionalInfo !== undefined && { additionalInfo: additionalInfo || null }),
        ...(socialMedia !== undefined && { socialMedia: socialMedia || null }),
        ...(workingHours !== undefined && { workingHours: workingHours || null }),
        ...(location !== undefined && { location: location || null }),
        // Профіль
        ...(niche !== undefined && { 
          niche: Object.values(BusinessNiche).includes(niche as BusinessNiche) 
            ? (niche as BusinessNiche) 
            : BusinessNiche.OTHER 
        }),
        ...(customNiche !== undefined && { customNiche: customNiche || null }),
        ...(businessIdentifier !== undefined && { businessIdentifier: businessIdentifier || null }),
        ...(profileCompleted !== undefined && { profileCompleted }),
        // AI Chat
        ...(aiChatEnabled !== undefined && { aiChatEnabled }),
        ...(aiProvider !== undefined && { aiProvider: aiProvider || null }),
        ...(aiApiKey !== undefined && { aiApiKey: aiApiKey || null }),
        ...(aiSettings !== undefined && { aiSettings: aiSettings || null }),
        // SMS
        ...(smsProvider !== undefined && { smsProvider: smsProvider || null }),
        ...(smsApiKey !== undefined && { smsApiKey: smsApiKey || null }),
        ...(smsSender !== undefined && { smsSender: smsSender || null }),
        // Email
        ...(emailProvider !== undefined && { emailProvider: emailProvider || null }),
        ...(emailApiKey !== undefined && { emailApiKey: emailApiKey || null }),
        ...(emailFrom !== undefined && { emailFrom: emailFrom || null }),
        ...(emailFromName !== undefined && { emailFromName: emailFromName || null }),
        // Payment
        ...(paymentProvider !== undefined && { paymentProvider: paymentProvider || null }),
        ...(paymentApiKey !== undefined && { paymentApiKey: paymentApiKey || null }),
        ...(paymentMerchantId !== undefined && { paymentMerchantId: paymentMerchantId || null }),
        ...(paymentEnabled !== undefined && { paymentEnabled }),
        // Reminders
        ...(remindersEnabled !== undefined && { remindersEnabled }),
        ...(reminderSmsEnabled !== undefined && { reminderSmsEnabled }),
        ...(reminderEmailEnabled !== undefined && { reminderEmailEnabled }),
      },
      select: businessSelect,
      })
    } catch (updateError: any) {
      console.error('Error updating business in database:', updateError)
      
      // Детальна обробка помилок оновлення
      if (updateError?.code === 'P2025') {
        return NextResponse.json({ 
          error: 'Бізнес не знайдено. Будь ласка, увійдіть знову.' 
        }, { status: 404 })
      }
      
      if (updateError?.code === 'P2002') {
        // Unique constraint violation
        const target = updateError?.meta?.target
        if (Array.isArray(target)) {
          if (target.includes('email')) {
            return NextResponse.json({ 
              error: 'Email вже використовується іншим бізнесом' 
            }, { status: 409 })
          }
          if (target.includes('businessIdentifier')) {
            return NextResponse.json({ 
              error: 'Ідентифікатор бізнесу вже зайнятий. Спробуйте ще раз.' 
            }, { status: 409 })
          }
          if (target.includes('slug')) {
            return NextResponse.json({ 
              error: 'URL-адреса вже зайнята' 
            }, { status: 409 })
          }
        }
        return NextResponse.json({ 
          error: 'Ці дані вже використовуються іншим бізнесом' 
        }, { status: 409 })
      }
      
      // Якщо це помилка валідації
      if (updateError?.code === 'P2003') {
        return NextResponse.json({ 
          error: 'Невірний формат даних. Перевірте введені значення.' 
        }, { status: 400 })
      }
      
      // Інші помилки
      throw updateError
    }

    // Синхронізуємо всі дані в ManagementCenter (ПОВНЕ ДУБЛЮВАННЯ)
    // Це необов'язкова операція - якщо вона не вдається, це не повинно блокувати оновлення бізнесу
    try {
      const { syncBusinessToManagementCenter } = await import('@/lib/services/management-center')
      const syncResult = await syncBusinessToManagementCenter(businessId)
      if (!syncResult) {
        console.warn('ManagementCenter sync returned null, but continuing...')
      }
    } catch (syncError: any) {
      // Логуємо помилку, але не викидаємо її, щоб не зламати оновлення бізнесу
      console.error('Error syncing business to Management Center:', syncError)
      console.error('Sync error details:', {
        message: syncError?.message,
        code: syncError?.code,
        stack: syncError?.stack,
        name: syncError?.name,
      })
      // Продовжуємо виконання - синхронізація не критична для оновлення профілю
    }

    // Оновлюємо номер телефону в Реєстрі телефонів (якщо змінився)
    if (phone !== undefined && currentBusiness && phone !== currentBusiness.phone) {
      try {
        const { updateBusinessPhoneInDirectory } = await import('@/lib/services/management-center')
        await updateBusinessPhoneInDirectory(
          businessId,
          currentBusiness.phone,
          phone || null,
          business.name
        )
      } catch (phoneError: any) {
        console.error('Error updating business phone in directory:', phoneError)
        // Логуємо детальну інформацію про помилку
        console.error('Phone update error details:', {
          message: phoneError?.message,
          code: phoneError?.code,
          stack: phoneError?.stack,
        })
        // Не викидаємо помилку, щоб не зламати оновлення бізнесу
      }
    }

    return NextResponse.json({ business })
  } catch (error: any) {
    console.error('Unexpected error updating business:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      code: error?.code,
      meta: error?.meta,
    })
    
    // Перевіряємо, чи це помилка парсингу JSON
    if (error instanceof SyntaxError) {
      return NextResponse.json({ 
        error: 'Невірний формат даних. Перевірте введені значення.' 
      }, { status: 400 })
    }
    
    // Перевіряємо, чи це помилка бази даних
    if (error?.code?.startsWith('P')) {
      // Prisma помилка
      return NextResponse.json({ 
        error: 'Помилка бази даних. Будь ласка, спробуйте ще раз або зверніться до підтримки.' 
      }, { status: 500 })
    }
    
    // Загальна обробка несподіваних помилок
    return NextResponse.json({ 
      error: 'Помилка при збереженні профілю. Будь ласка, спробуйте ще раз.' 
    }, { status: 500 })
  }
}



