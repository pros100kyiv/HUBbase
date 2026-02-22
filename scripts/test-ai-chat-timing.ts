/**
 * Тест часу відповіді AI чату.
 * Запуск: npx tsx scripts/test-ai-chat-timing.ts
 * Потрібен запущений dev server (npm run dev)
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE = 'http://localhost:3000'

async function main() {
  const email = process.env.TEST_EMAIL || 'pros100kyiv@gmail.com'

  console.log(`\n🔍 Шукаю бізнес за email: ${email}`)
  const business = await prisma.business.findUnique({
    where: { email },
    select: { id: true, name: true, aiChatEnabled: true, aiApiKey: true },
  })

  if (!business) {
    const list = await prisma.business.findMany({ take: 5, select: { id: true, email: true, name: true } })
    console.log('Не знайдено. Доступні бізнеси:')
    list.forEach((b) => console.log(`  - ${b.email} (${b.name}) id=${b.id}`))
    process.exit(1)
  }

  console.log(`✅ Бізнес: ${business.name} (id=${business.id})`)
  console.log(`   aiChatEnabled: ${business.aiChatEnabled}, aiApiKey: ${business.aiApiKey ? 'є' : 'немає'}`)
  console.log('')

  const sessionId = `test_${Date.now()}`
  const message = 'привіт'

  console.log(`📤 POST /api/ai/chat message="${message}"`)
  const start = Date.now()

  const res = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessId: business.id,
      message,
      sessionId,
    }),
  })

  const elapsed = Date.now() - start
  const data = await res.json().catch(() => ({}))
  const ok = res.ok

  console.log(`\n⏱️  Час відповіді: ${elapsed} ms (${(elapsed / 1000).toFixed(2)} s)`)
  console.log(`   HTTP ${res.status} ${ok ? 'OK' : 'ERROR'}`)
  if (data.message) console.log(`   Відповідь: ${String(data.message).slice(0, 120)}...`)
  if (data.ai) {
    const ai = data.ai
    console.log(`   AI: used=${ai.usedAi}, source=${ai.source}, provider=${ai.provider}`)
  }
  if (data.error) console.log(`   Помилка: ${data.error}`)

  // Другий запит (snapshot вже в кеші)
  console.log('\n📤 Повторний запит (snapshot в кеші)...')
  const start2 = Date.now()
  const res2 = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessId: business.id,
      message: 'що сьогодні',
      sessionId,
    }),
  })
  const elapsed2 = Date.now() - start2
  console.log(`⏱️  Час 2-го запиту: ${elapsed2} ms`)
  console.log('')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
