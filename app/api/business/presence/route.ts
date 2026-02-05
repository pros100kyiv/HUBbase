import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Heartbeat API — оновлює lastSeenAt в ManagementCenter
 * Викликається з дашборду бізнесу, коли сторінка відкрита
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { businessId } = body

    if (!businessId || typeof businessId !== 'string') {
      return NextResponse.json(
        { error: 'businessId is required' },
        { status: 400 }
      )
    }

    // Перевіряємо, чи бізнес існує
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    const now = new Date()

    // Оновлюємо lastSeenAt в ManagementCenter
    await prisma.managementCenter.update({
      where: { businessId },
      data: { lastSeenAt: now },
    }).catch(async () => {
      // Якщо запис не існує, синхронізуємо й оновлюємо
      const { syncBusinessToManagementCenter } = await import('@/lib/services/management-center')
      await syncBusinessToManagementCenter(businessId)
      await prisma.managementCenter.update({
        where: { businessId },
        data: { lastSeenAt: now },
      })
    })

    return NextResponse.json({
      success: true,
      lastSeenAt: now.toISOString(),
    })
  } catch (error) {
    console.error('Presence heartbeat error:', error)
    return NextResponse.json(
      { error: 'Помилка оновлення статусу' },
      { status: 500 }
    )
  }
}
