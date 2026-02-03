import { prisma } from '@/lib/prisma'

/**
 * Helper для роботи з Row Level Security (RLS) в PostgreSQL
 * Використовується для встановлення поточного business_id в сесії
 */

/**
 * Встановлює поточний business_id в сесійній змінній для RLS
 * Використовується перед виконанням запитів для ізоляції даних
 */
export async function setCurrentBusinessId(businessId: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `SELECT set_current_business_id($1::UUID)`,
      businessId
    )
  } catch (error) {
    console.error('Error setting current business ID for RLS:', error)
    // Не викидаємо помилку, щоб не зламати запити
  }
}

/**
 * Отримує поточний business_id з сесійної змінної
 */
export async function getCurrentBusinessId(): Promise<string | null> {
  try {
    const result = await prisma.$queryRawUnsafe<Array<{ get_current_business_id: string | null }>>(
      `SELECT get_current_business_id() as get_current_business_id`
    )
    return result[0]?.get_current_business_id || null
  } catch (error) {
    console.error('Error getting current business ID from RLS:', error)
    return null
  }
}

/**
 * Виконує запит з встановленим business_id для RLS
 * Автоматично встановлює business_id перед запитом та очищає після
 */
export async function executeWithRLS<T>(
  businessId: string,
  query: () => Promise<T>
): Promise<T> {
  try {
    // Встановлюємо business_id для RLS
    await setCurrentBusinessId(businessId)
    
    // Виконуємо запит
    const result = await query()
    
    return result
  } catch (error) {
    console.error('Error executing query with RLS:', error)
    throw error
  } finally {
    // Очищаємо business_id (встановлюємо NULL)
    try {
      await prisma.$executeRawUnsafe(`SELECT set_current_business_id(NULL::UUID)`)
    } catch (error) {
      // Ігноруємо помилки очищення
    }
  }
}

/**
 * Middleware для автоматичного встановлення business_id з запиту
 * Використовується в API routes
 */
export function withRLS(businessId: string | null) {
  return async <T>(query: () => Promise<T>): Promise<T> => {
    if (!businessId) {
      return query()
    }
    return executeWithRLS(businessId, query)
  }
}

