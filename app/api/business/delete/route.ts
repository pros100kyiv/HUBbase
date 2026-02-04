import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveBusinessId } from '@/lib/utils/business-identifier'
import { z } from 'zod'

const deleteSchema = z.object({
  businessIdentifier: z.string().min(1, 'businessIdentifier is required'),
  confirmDelete: z.boolean().optional().default(false),
})

/**
 * Видалення акаунту бізнесу
 * DELETE /api/business/delete
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessIdentifier = searchParams.get('businessIdentifier')

    if (!businessIdentifier) {
      return NextResponse.json({ 
        error: 'businessIdentifier is required' 
      }, { status: 400 })
    }

    // Конвертуємо 5-значний ID в внутрішній ID
    const businessId = await resolveBusinessId(businessIdentifier)
    
    if (!businessId) {
      return NextResponse.json({ 
        error: 'Бізнес не знайдено за вказаним ідентифікатором' 
      }, { status: 404 })
    }

    // Отримуємо інформацію про бізнес перед видаленням
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        email: true,
        businessIdentifier: true,
        createdAt: true,
      }
    })

    if (!business) {
      return NextResponse.json({ 
        error: 'Бізнес не знайдено' 
      }, { status: 404 })
    }

    // Видаляємо бізнес (каскадне видалення через Prisma)
    // Всі пов'язані дані (masters, services, appointments, clients, тощо) будуть видалені автоматично
    await prisma.business.delete({
      where: { id: businessId },
    })

    return NextResponse.json({
      success: true,
      message: 'Акаунт успішно видалено',
      deletedBusiness: {
        id: business.id,
        name: business.name,
        email: business.email,
        businessIdentifier: business.businessIdentifier,
      },
    })
  } catch (error) {
    console.error('Error deleting business:', error)
    return NextResponse.json({ 
      error: 'Помилка при видаленні акаунту' 
    }, { status: 500 })
  }
}

