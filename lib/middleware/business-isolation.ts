import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Middleware для забезпечення ізоляції даних між бізнесами
 * КРИТИЧНО ВАЖЛИВО: Кожен бізнес має доступ тільки до своїх даних
 */

/**
 * Отримує businessId з запиту (query params, body, або headers)
 */
export function extractBusinessId(request: NextRequest, body?: any): string | null {
  // 1. З query parameters
  const searchParams = request.nextUrl.searchParams
  const queryBusinessId = searchParams.get('businessId')
  if (queryBusinessId) return queryBusinessId

  // 2. З body (якщо передано)
  if (body?.businessId) return body.businessId

  // 3. З headers (для особливих випадків)
  const headerBusinessId = request.headers.get('x-business-id')
  if (headerBusinessId) return headerBusinessId

  return null
}

/**
 * Перевіряє, чи businessId валідний та існує в базі
 */
export async function validateBusinessId(businessId: string): Promise<boolean> {
  if (!businessId || typeof businessId !== 'string' || businessId.trim().length === 0) {
    return false
  }

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, isActive: true }
    })

    return !!business && business.isActive
  } catch (error) {
    console.error('Error validating businessId:', error)
    return false
  }
}

/**
 * Middleware для перевірки businessId в API routes
 * Використання:
 * 
 * export async function POST(request: NextRequest) {
 *   const businessId = await requireBusinessId(request)
 *   if (!businessId) {
 *     return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
 *   }
 *   // ... ваш код
 * }
 */
export async function requireBusinessId(request: NextRequest, body?: any): Promise<string | null> {
  const businessId = extractBusinessId(request, body)
  
  if (!businessId) {
    return null
  }

  const isValid = await validateBusinessId(businessId)
  if (!isValid) {
    return null
  }

  return businessId
}

/**
 * Додає businessId до where clause для забезпечення ізоляції
 * Використання:
 * 
 * const where = ensureBusinessIsolation(businessId, { status: 'active' })
 * // Результат: { businessId: '...', status: 'active' }
 */
export function ensureBusinessIsolation(businessId: string, additionalWhere?: any): any {
  if (!businessId) {
    throw new Error('businessId is required for data isolation')
  }

  return {
    businessId,
    ...(additionalWhere || {})
  }
}

/**
 * Перевіряє, чи запит належить правильному бізнесу
 * Використовується для перевірки при оновленні/видаленні записів
 */
export async function verifyBusinessOwnership(
  businessId: string,
  model: 'appointment' | 'master' | 'service' | 'client',
  recordId: string
): Promise<boolean> {
  if (!businessId || !recordId) {
    return false
  }

  try {
    let record: any = null

    switch (model) {
      case 'appointment':
        record = await prisma.appointment.findUnique({
          where: { id: recordId },
          select: { businessId: true }
        })
        break
      case 'master':
        record = await prisma.master.findUnique({
          where: { id: recordId },
          select: { businessId: true }
        })
        break
      case 'service':
        record = await prisma.service.findUnique({
          where: { id: recordId },
          select: { businessId: true }
        })
        break
      case 'client':
        record = await prisma.client.findUnique({
          where: { id: recordId },
          select: { businessId: true }
        })
        break
    }

    return record?.businessId === businessId
  } catch (error) {
    console.error('Error verifying business ownership:', error)
    return false
  }
}

