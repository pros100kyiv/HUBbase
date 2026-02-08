import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveBusinessId } from '@/lib/utils/business-identifier'

/**
 * Видалення акаунту бізнесу з усіма пов'язаними даними.
 * При видаленні Business (User/Account) автоматично видаляються:
 * - Prisma Cascade: masters, services, appointments, clients, BusinessUser,
 *   TelegramUser, TelegramBroadcast, TelegramReminder, AIChatMessage,
 *   Broadcast, Payment, ClientSegment, SMSMessage, SocialIntegration,
 *   Note, BusinessModule, AnalyticsReport, DataImport, DataExport
 * - Вручну: ManagementCenter, TelegramLog, PhoneDirectory, GraphNode,
 *   GraphRelationship, TelegramVerification
 *
 * POST /api/business/delete — приймає { businessId } у body для підтвердження
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { businessId: paramBusinessId, businessIdentifier } = body as {
      businessId?: string
      businessIdentifier?: string
    }

    const identifier = paramBusinessId || businessIdentifier
    if (!identifier) {
      return NextResponse.json(
        { error: 'Потрібен businessId або businessIdentifier' },
        { status: 400 }
      )
    }

    const businessId = await resolveBusinessId(identifier)
    if (!businessId) {
      return NextResponse.json(
        { error: 'Бізнес не знайдено за вказаним ідентифікатором' },
        { status: 404 }
      )
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        email: true,
        businessIdentifier: true,
      },
    })

    if (!business) {
      return NextResponse.json({ error: 'Бізнес не знайдено' }, { status: 404 })
    }

    // Транзакція: спочатку видаляємо дані без FK до Business
    await prisma.$transaction(async (tx) => {
      // 1. ManagementCenter (дублікат бізнесу в центрі управління)
      await tx.managementCenter.deleteMany({ where: { businessId } })

      // 2. TelegramLog (логи бота, немає FK до Business)
      await tx.telegramLog.deleteMany({ where: { businessId } })

      // 3. TelegramVerification (коди підтвердження)
      await tx.telegramVerification.deleteMany({ where: { businessId } })

      // 4. PhoneDirectory (номери телефонів)
      await tx.phoneDirectory.deleteMany({ where: { businessId } })

      // 5. GraphRelationship (зв'язки графу, before GraphNode)
      await tx.graphRelationship.deleteMany({ where: { businessId } })

      // 6. GraphNode (вузли графу)
      await tx.graphNode.deleteMany({ where: { businessId } })

      // 7. Business — каскад видалить: Master, Service, Client, Appointment,
      //    BusinessUser, TelegramUser, TelegramBroadcast, TelegramReminder,
      //    AIChatMessage, Broadcast, Payment, ClientSegment, SMSMessage,
      //    SocialIntegration, Note, BusinessModule, AnalyticsReport,
      //    DataImport, DataExport
      await tx.business.delete({ where: { id: businessId } })
    })

    return NextResponse.json({
      success: true,
      message: 'Акаунт успішно видалено',
      deletedBusiness: {
        id: business.id,
        name: business.name,
        email: business.email,
        businessIdentifier: business.businessIdentifier,
      },
    })
  } catch (error) {
    console.error('Error deleting business:', error)
    return NextResponse.json(
      { error: 'Помилка при видаленні акаунту' },
      { status: 500 }
    )
  }
}

