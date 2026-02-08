import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveBusinessId } from '@/lib/utils/business-identifier'
import { z } from 'zod'

const blockSchema = z.object({
  businessIdentifier: z.string().min(1, 'businessIdentifier is required'),
  isActive: z.boolean().optional().default(false),
  reason: z.string().optional(),
})

/**
 * Блокування/розблоковування акаунту за businessIdentifier
 * POST /api/business/block
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = blockSchema.parse(body)

    // Конвертуємо 5-значний ID в внутрішній ID
    const businessId = await resolveBusinessId(validated.businessIdentifier)
    
    if (!businessId) {
      return NextResponse.json({ 
        error: 'Бізнес не знайдено за вказаним ідентифікатором' 
      }, { status: 404 })
    }

    // Отримуємо поточний стан бізнесу
    const currentBusiness = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        email: true,
        businessIdentifier: true,
        isActive: true,
        settings: true,
      }
    })

    if (!currentBusiness) {
      return NextResponse.json({ 
        error: 'Бізнес не знайдено' 
      }, { status: 404 })
    }

    // Парсимо settings для додавання причини блокування
    let settings = currentBusiness.settings ? JSON.parse(currentBusiness.settings) : {}
    
    if (!validated.isActive && validated.reason) {
      // Додаємо інформацію про блокування
      settings.blockReason = validated.reason
      settings.blockedAt = new Date().toISOString()
      settings.blockedBy = 'admin' // Можна додати ID адміна
    } else if (validated.isActive) {
      // Видаляємо інформацію про блокування при розблоковуванні
      delete settings.blockReason
      delete settings.blockedAt
      delete settings.blockedBy
      settings.unblockedAt = new Date().toISOString()
    }

    // Блокуємо/розблоковуємо акаунт
    const business = await prisma.business.update({
      where: { id: businessId },
      data: {
        isActive: validated.isActive,
        settings: Object.keys(settings).length > 0 ? JSON.stringify(settings) : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        businessIdentifier: true,
        isActive: true,
        phone: true,
        createdAt: true,
      }
    })

    return NextResponse.json({
      success: true,
      message: validated.isActive 
        ? 'Акаунт успішно розблоковано' 
        : 'Акаунт успішно заблоковано',
      business,
      action: validated.isActive ? 'unblocked' : 'blocked',
      reason: validated.reason || null,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: error.errors[0].message 
      }, { status: 400 })
    }
    console.error('Error blocking business:', error)
    return NextResponse.json({ 
      error: 'Помилка при блокуванні акаунту' 
    }, { status: 500 })
  }
}

/**
 * Отримати інформацію про статус блокування
 * GET /api/business/block?businessIdentifier=56836
 * GET /api/business/block?businessId=clxxx (UUID — для перевірки з dashboard)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const identifier = searchParams.get('businessIdentifier') || searchParams.get('businessId')

    if (!identifier) {
      return NextResponse.json({ 
        error: 'businessIdentifier або businessId обов\'язковий' 
      }, { status: 400 })
    }

    const businessId = await resolveBusinessId(identifier)
    
    if (!businessId) {
      return NextResponse.json({ 
        error: 'Бізнес не знайдено' 
      }, { status: 404 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        email: true,
        businessIdentifier: true,
        isActive: true,
        settings: true,
      }
    })

    if (!business) {
      return NextResponse.json({ 
        error: 'Бізнес не знайдено' 
      }, { status: 404 })
    }

    // Парсимо settings для отримання причини блокування
    let blockInfo: { reason?: string; blockedAt?: string; blockedBy?: string } | null = null
    if (business.isActive === false) {
      if (business.settings) {
        try {
          const settings = JSON.parse(business.settings)
          if (settings.blockReason || settings.blockedAt) {
            blockInfo = {
              reason: settings.blockReason || 'Акаунт заблоковано адміністратором',
              blockedAt: settings.blockedAt,
              blockedBy: settings.blockedBy,
            }
          }
        } catch (e) {
          // Settings не є валідним JSON
        }
      }
      if (!blockInfo) {
        blockInfo = { reason: 'Акаунт заблоковано адміністратором' }
      }
    }

    return NextResponse.json({
      business: {
        id: business.id,
        name: business.name,
        email: business.email,
        businessIdentifier: business.businessIdentifier,
        isActive: business.isActive,
      },
      blockInfo,
    })
  } catch (error) {
    console.error('Error fetching block status:', error)
    return NextResponse.json({ 
      error: 'Помилка при отриманні статусу блокування' 
    }, { status: 500 })
  }
}

