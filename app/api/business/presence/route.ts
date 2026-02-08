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
    try {
      await prisma.managementCenter.update({
        where: { businessId },
        data: { lastSeenAt: now },
      })
    } catch (updateErr: unknown) {
      // Якщо запис не існує — синхронізуємо й повторюємо
      try {
        const { syncBusinessToManagementCenter } = await import('@/lib/services/management-center')
        await syncBusinessToManagementCenter(businessId)
        await prisma.managementCenter.update({
          where: { businessId },
          data: { lastSeenAt: now },
        })
      } catch (retryErr: unknown) {
        console.warn('Presence: ManagementCenter sync/update failed, returning success anyway', { businessId, retryErr })
        // Не повертаємо 500 — presence не критичний для UI
        return NextResponse.json({ success: true, lastSeenAt: now.toISOString() })
      }
    }

    return NextResponse.json({
      success: true,
      lastSeenAt: now.toISOString(),
    })
  } catch (error) {
    console.error('Presence heartbeat error:', error)
    // Не ламаємо UI — presence тільки для статусу онлайн
    return NextResponse.json({ success: false, error: 'Помилка оновлення' })
  }
}
