import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Перевіряє чи параметр є UUID (ID) чи slug
// CUID має формат: c[0-9a-z]{24} або схожий
function isUUID(str: string): boolean {
  // Перевіряємо UUID формат
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(str)) return true
  
  // Перевіряємо CUID формат (використовується Prisma за замовчуванням)
  const cuidRegex = /^c[0-9a-z]{24}$/i
  if (cuidRegex.test(str)) return true
  
  // Якщо це не UUID і не CUID, але має достатню довжину - вважаємо ID
  // (може бути інший формат ID)
  return str.length > 10 && !str.includes('-') && !str.includes('_')
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
    if (!isUUID(param)) {
      console.error('Invalid business ID format:', param)
      return NextResponse.json({ 
        error: 'Невірний формат ідентифікатора бізнесу. Будь ласка, увійдіть знову.' 
      }, { status: 400 })
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
    const currentBusiness = await prisma.business.findUnique({
      where: { id: param },
      select: { phone: true, name: true },
    })

    const business = await prisma.business.update({
      where: { id: param },
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
        ...(niche !== undefined && { niche }),
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

    // Синхронізуємо всі дані в ManagementCenter (ПОВНЕ ДУБЛЮВАННЯ)
    try {
      const { syncBusinessToManagementCenter } = await import('@/lib/services/management-center')
      await syncBusinessToManagementCenter(param)
    } catch (error) {
      console.error('Error syncing business to Management Center:', error)
      // Не викидаємо помилку, щоб не зламати оновлення бізнесу
    }

    // Оновлюємо номер телефону в Реєстрі телефонів (якщо змінився)
    if (phone !== undefined && currentBusiness && phone !== currentBusiness.phone) {
      try {
        const { updateBusinessPhoneInDirectory } = await import('@/lib/services/management-center')
        await updateBusinessPhoneInDirectory(
          param,
          currentBusiness.phone,
          phone || null,
          business.name
        )
      } catch (error) {
        console.error('Error updating business phone in directory:', error)
        // Не викидаємо помилку, щоб не зламати оновлення бізнесу
      }
    }

    return NextResponse.json({ business })
  } catch (error) {
    console.error('Error updating business:', error)
    
    // Детальна обробка помилок
    let errorMessage = 'Помилка при оновленні профілю'
    
    if (error instanceof Error) {
      // Перевірка на помилки бази даних
      if (error.message.includes('Unique constraint') || error.message.includes('duplicate')) {
        if (error.message.includes('email')) {
          errorMessage = 'Email вже використовується іншим бізнесом'
        } else if (error.message.includes('businessIdentifier')) {
          errorMessage = 'Ідентифікатор бізнесу вже зайнятий. Спробуйте ще раз.'
        } else if (error.message.includes('slug')) {
          errorMessage = 'URL-адреса вже зайнята'
        } else {
          errorMessage = 'Ці дані вже використовуються іншим бізнесом'
        }
      } else if (error.message.includes('Record to update not found')) {
        errorMessage = 'Бізнес не знайдено. Будь ласка, увійдіть знову.'
      } else if (error.message.includes('invalid input syntax')) {
        errorMessage = 'Невірний формат даних. Перевірте введені значення.'
      } else {
        errorMessage = 'Помилка при збереженні профілю. Будь ласка, спробуйте ще раз.'
      }
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}



