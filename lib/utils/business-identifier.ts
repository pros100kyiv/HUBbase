import { prisma } from '@/lib/prisma'

/**
 * Генерує унікальний businessIdentifier для швидкого пошуку
 * Формат: 5-значне число (10000-99999)
 */
export async function generateBusinessIdentifier(): Promise<string> {
  let attempts = 0
  const maxAttempts = 100

  while (attempts < maxAttempts) {
    // Генеруємо 5-значне число (10000-99999)
    const identifier = Math.floor(10000 + Math.random() * 90000).toString()

    // Перевіряємо унікальність
    const existing = await prisma.business.findUnique({
      where: { businessIdentifier: identifier },
      select: { id: true },
    })

    if (!existing) {
      return identifier
    }

    attempts++
  }

  // Якщо не вдалося знайти унікальний за 100 спроб, використовуємо timestamp
  return Date.now().toString().slice(-8) // Останні 8 цифр timestamp
}

/**
 * Знаходить бізнес за businessIdentifier або ID
 */
export async function findBusinessByIdentifier(identifier: string) {
  // Спробуємо знайти за businessIdentifier (число)
  if (/^\d+$/.test(identifier)) {
    const byIdentifier = await prisma.business.findUnique({
      where: { businessIdentifier: identifier },
    })
    if (byIdentifier) return byIdentifier
  }

  // Спробуємо знайти за ID (CUID або UUID)
  const byId = await prisma.business.findUnique({
    where: { id: identifier },
  })
  if (byId) return byId

  // Спробуємо знайти за email
  const byEmail = await prisma.business.findUnique({
    where: { email: identifier.toLowerCase().trim() },
  })
  if (byEmail) return byEmail

  // Спробуємо знайти за slug
  const bySlug = await prisma.business.findUnique({
    where: { slug: identifier },
  })
  if (bySlug) return bySlug

  return null
}

/**
 * Конвертує businessIdentifier в businessId для використання в API
 * Підтримує як businessIdentifier (число), так і внутрішній ID
 */
export async function resolveBusinessId(identifier: string): Promise<string | null> {
  if (!identifier) return null

  // Якщо це число - шукаємо за businessIdentifier
  if (/^\d+$/.test(identifier)) {
    const business = await prisma.business.findUnique({
      where: { businessIdentifier: identifier },
      select: { id: true },
    })
    if (business) return business.id
  }

  // Якщо це CUID або UUID - перевіряємо чи існує
  const business = await prisma.business.findUnique({
    where: { id: identifier },
    select: { id: true },
  })
  if (business) return business.id

  return null
}

/**
 * Отримує businessIdentifier бізнесу або генерує новий якщо відсутній
 */
export async function getOrGenerateBusinessIdentifier(businessId: string): Promise<string> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { businessIdentifier: true },
  })

  if (business?.businessIdentifier) {
    return business.businessIdentifier
  }

  // Генеруємо новий identifier
  const newIdentifier = await generateBusinessIdentifier()
  
  await prisma.business.update({
    where: { id: businessId },
    data: { businessIdentifier: newIdentifier },
  })

  return newIdentifier
}

