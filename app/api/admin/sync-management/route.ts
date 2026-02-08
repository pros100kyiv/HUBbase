import { NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/middleware/admin-auth'
import { syncAllBusinessesToManagementCenter } from '@/lib/services/management-center'

export const dynamic = 'force-dynamic'

/**
 * POST: Синхронізує всі бізнеси з Business в ManagementCenter
 * Включає вже створені акаунти — всі дані будуть відображатися в центрі управління
 */
export async function POST(request: Request) {
  const auth = verifyAdminToken(request as any)
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncAllBusinessesToManagementCenter()
    return NextResponse.json({
      success: true,
      total: result.total,
      synced: result.synced,
      message: `Синхронізовано ${result.synced} з ${result.total} бізнесів`,
    })
  } catch (error: any) {
    console.error('Sync management error:', error)
    return NextResponse.json(
      { error: error?.message || 'Помилка синхронізації' },
      { status: 500 }
    )
  }
}
