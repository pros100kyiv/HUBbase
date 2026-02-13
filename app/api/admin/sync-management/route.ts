import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withDbRetry } from '@/lib/db-retry'
import { verifyAdminToken } from '@/lib/middleware/admin-auth'
import { syncAllBusinessesToManagementCenter } from '@/lib/services/management-center'

export const dynamic = 'force-dynamic'

/**
 * POST: Синхронізує всі бізнеси з Business в ManagementCenter
 * Спочатку "прокидає" БД (Neon cold start), потім виконує синхронізацію.
 */
export async function POST(request: Request) {
  const auth = verifyAdminToken(request as any)
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await withDbRetry(() => prisma.$queryRaw`SELECT 1`, { maxAttempts: 5, delayMs: 3000 })
    const result = await syncAllBusinessesToManagementCenter()
    return NextResponse.json({
      success: true,
      total: result.total,
      synced: result.synced,
      message: `Синхронізовано ${result.synced} з ${result.total} бізнесів`,
    })
  } catch (error: any) {
    console.error('Sync management error:', error)
    const msg = error?.message || ''
    const isDbUnreachable = /can't reach database|connection refused|database server/i.test(msg)
    const userMessage = isDbUnreachable
      ? 'База даних ще прокидається. Зачекайте 15–20 секунд і натисніть «Синхронізувати» знову.'
      : msg || 'Помилка синхронізації'
    return NextResponse.json({ error: userMessage }, { status: 500 })
  }
}
