import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveBusinessId } from '@/lib/utils/business-identifier'

async function deleteBusiness(identifier: string) {
  const businessId = await resolveBusinessId(identifier)
  if (!businessId) {
    return { error: 'Бізнес не знайдено за вказаним ідентифікатором', status: 404 }
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, email: true, businessIdentifier: true },
  })

  if (!business) {
    return { error: 'Бізнес не знайдено', status: 404 }
  }

  await prisma.$transaction(async (tx) => {
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

    const identifier = paramBusinessId || businessIdentifier
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
/**
 * DELETE /api/business/delete?businessIdentifier=56836 — видалення за query-параметром
 */
export async function DELETE(request: Request) {
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

