/**
 * Діагностика вузького місця: що саме повільно?
 * npx tsx scripts/test-ai-chat-bottleneck.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now()
  const result = await fn()
  console.log(`  ${label}: ${Date.now() - start} ms`)
  return result
}

async function main() {
  console.log('\n🔬 Діагностика AI чату (pros100kyiv@gmail.com)\n')

  const businessId = 'cmlo23jwq0001km7ohvnnipem'

  await time('1. Prisma connect (перший запит)', async () => {
    await prisma.$queryRaw`SELECT 1`
  })

  await time('2. SystemSetting (ai_provider, lm_studio)', async () => {
    await prisma.systemSetting.findMany({
      where: { key: { in: ['ai_provider', 'lm_studio_base_url', 'lm_studio_model'] } },
    })
  })

  await time('3. Business findUnique', async () => {
    await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        services: { where: { isActive: true } },
        masters: { where: { isActive: true } },
      },
    })
  })

  await time('4. AIChatMessage findMany', async () => {
    await prisma.aIChatMessage.findMany({
      where: { businessId, sessionId: 'default' },
      orderBy: { createdAt: 'asc' },
      take: 10,
    })
  })

  // Snapshot = 4 tool calls + 3 counts
  await time('5. Snapshot: biz_overview + kpi + stats + payments', async () => {
    const { toolBizOverview, toolAnalyticsKpi, toolAppointmentsStats, toolPaymentsKpi } = await import('../lib/services/ai-data-tools')
    await Promise.all([
      toolBizOverview(businessId),
      toolAnalyticsKpi(businessId, { days: 7 }),
      toolAppointmentsStats(businessId, { days: 7 }),
      toolPaymentsKpi(businessId, { days: 30 }),
    ])
  })

  console.log('\n✅ Готово. Якщо пункт 1 або 2 > 5 сек — можлива cold start БД (Neon).\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
