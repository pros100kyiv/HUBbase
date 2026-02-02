import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Перевіряє чи параметр є UUID (ID) чи slug
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
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

    // PATCH тільки для ID
    if (!isUUID(param)) {
      console.error('Invalid business ID format:', param)
      return NextResponse.json({ error: 'Invalid business ID', details: `Expected UUID format, got: ${param}` }, { status: 400 })
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

    return NextResponse.json({ business })
  } catch (error) {
    console.error('Error updating business:', error)
    return NextResponse.json({ error: 'Failed to update business' }, { status: 500 })
  }
}



