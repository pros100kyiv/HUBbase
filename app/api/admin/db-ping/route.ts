import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withDbRetry } from '@/lib/db-retry'
import { verifyAdminToken } from '@/lib/middleware/admin-auth'

export const dynamic = 'force-dynamic'

/**
 * GET: Легкий пінг БД для keep-alive (щоб Neon не засинав під час роботи в центрі управління).
 */
export async function GET(request: Request) {
  const auth = verifyAdminToken(request as any)
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await withDbRetry(() => prisma.$queryRaw`SELECT 1`, { maxAttempts: 2, delayMs: 2000 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DB ping error:', e)
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
