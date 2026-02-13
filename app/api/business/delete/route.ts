import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveBusinessId } from '@/lib/utils/business-identifier'
import { verifyAdminToken } from '@/lib/middleware/admin-auth'
import { generateDeviceId, getClientIp, getUserAgent, isDeviceTrusted } from '@/lib/utils/device'

async function deleteBusiness(identifier: string) {
  const businessId = await resolveBusinessId(identifier)
  if (!businessId) {
    return { error: 'Бізнес не знайдено за вказаним ідентифікатором', status: 404 }
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, email: true, businessIdentifier: true, telegramBotToken: true },
  })

  if (!business) {
    return { error: 'Бізнес не знайдено', status: 404 }
  }

  // Знімаємо webhook у Telegram, щоб бот не отримував оновлення і той самий акаунт міг зареєструватися знову
  const botToken = business.telegramBotToken
  if (botToken) {
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, { method: 'POST' })
    } catch (e) {
      console.warn('Telegram deleteWebhook failed for business', businessId, e)
    }
  }

  await prisma.$transaction(async (tx) => {
    // Порядок: спочатку залежні від бізнесу та інших сутностей, потім сам бізнес
    await tx.sMSMessage.deleteMany({ where: { businessId } })
    await tx.aIChatMessage.deleteMany({ where: { businessId } })
    await tx.payment.deleteMany({ where: { businessId } })
    await tx.broadcast.deleteMany({ where: { businessId } })
    await tx.appointment.deleteMany({ where: { businessId } })
    await tx.telegramReminder.deleteMany({ where: { businessId } })
    await tx.clientSegment.deleteMany({ where: { businessId } })
    await tx.analyticsReport.deleteMany({ where: { businessId } })
    await tx.dataImport.deleteMany({ where: { businessId } })
    await tx.dataExport.deleteMany({ where: { businessId } })
    await tx.note.deleteMany({ where: { businessId } })
    await tx.socialInboxMessage.deleteMany({ where: { businessId } })
    await tx.businessModule.deleteMany({ where: { businessId } })
    await tx.businessUser.deleteMany({ where: { businessId } })
    await tx.telegramBroadcast.deleteMany({ where: { businessId } })
    await tx.telegramUser.deleteMany({ where: { businessId } })
    await tx.socialIntegration.deleteMany({ where: { businessId } })
    const masterIds = (await tx.master.findMany({ where: { businessId }, select: { id: true } })).map((m) => m.id)
    if (masterIds.length > 0) {
      await tx.masterUtilization.deleteMany({ where: { masterId: { in: masterIds } } })
    }
    await tx.master.deleteMany({ where: { businessId } })
    await tx.service.deleteMany({ where: { businessId } })
    await tx.client.deleteMany({ where: { businessId } })
    await tx.managementCenter.deleteMany({ where: { businessId } })
    await tx.telegramLog.deleteMany({ where: { businessId } })
    await tx.telegramVerification.deleteMany({ where: { businessId } })
    await tx.phoneDirectory.deleteMany({ where: { businessId } })
    await tx.graphRelationship.deleteMany({ where: { businessId } })
    await tx.graphNode.deleteMany({ where: { businessId } })
    await tx.business.delete({ where: { id: businessId } })
  })

  return {
    success: true,
    message: 'Акаунт успішно видалено',
    deletedBusiness: business,
    status: 200,
  }
}

/**
 * Видалення акаунту бізнесу з усіма пов'язаними даними.
 * POST /api/business/delete — приймає { businessId | businessIdentifier } у body
 * DELETE /api/business/delete?businessIdentifier=56836 — приймає ID у query
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { businessId: paramBusinessId, businessIdentifier } = body as {
      businessId?: string
      businessIdentifier?: string
    }

    const auth = verifyAdminToken(request as any)
    const isAdminRequest = auth.valid

    // Self-delete з кабінету: дозволяємо тільки по businessId (без businessIdentifier).
    // Видалення по businessIdentifier залишається адмінською операцією.
    if (!isAdminRequest && !paramBusinessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Для self-delete обов'язково перевіряємо довірений пристрій.
    // Це не дає видалити акаунт лише за знанням businessId.
    if (!isAdminRequest && paramBusinessId) {
      const businessForDeviceCheck = await prisma.business.findUnique({
        where: { id: paramBusinessId },
        select: { trustedDevices: true },
      })

      const deviceId = generateDeviceId(getClientIp(request), getUserAgent(request))
      const isTrustedDevice = isDeviceTrusted(
        businessForDeviceCheck?.trustedDevices || null,
        deviceId
      )

      if (!businessForDeviceCheck || !isTrustedDevice) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const identifier = isAdminRequest ? (paramBusinessId || businessIdentifier) : paramBusinessId
    if (!identifier) {
      return NextResponse.json(
        { error: 'Потрібен businessId або businessIdentifier' },
        { status: 400 }
      )
    }

    const result = await deleteBusiness(identifier)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status as number })
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      deletedBusiness: result.deletedBusiness,
    })
  } catch (error) {
    console.error('Error deleting business:', error)
    return NextResponse.json(
      { error: 'Помилка при видаленні акаунту' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/business/delete?businessIdentifier=56836 — видалення за query-параметром
 */
export async function DELETE(request: Request) {
  const auth = verifyAdminToken(request as any)
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const businessIdentifier = searchParams.get('businessIdentifier')

    if (!businessIdentifier) {
      return NextResponse.json(
        { error: 'Потрібен businessIdentifier у query' },
        { status: 400 }
      )
    }

    const result = await deleteBusiness(businessIdentifier)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status as number })
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      deletedBusiness: result.deletedBusiness,
    })
  } catch (error) {
    console.error('Error deleting business (DELETE):', error)
    return NextResponse.json(
      { error: 'Помилка при видаленні акаунту' },
      { status: 500 }
    )
  }
}
