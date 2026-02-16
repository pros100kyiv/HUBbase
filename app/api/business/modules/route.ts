import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const moduleSchema = z.object({
  moduleKey: z.string().min(1, 'Module key is required'),
  moduleName: z.string().min(1, 'Module name is required'),
  isEnabled: z.boolean().optional(),
  settings: z.any().optional(),
  metadata: z.any().optional(),
})

// Отримати всі модулі бізнесу
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Перевіряємо чи бізнес існує
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const modules = await prisma.businessModule.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ modules })
  } catch (error) {
    console.error('Error fetching modules:', error)
    return NextResponse.json({ error: 'Failed to fetch modules' }, { status: 500 })
  }
}

// Створити або оновити модуль
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, ...moduleData } = body

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Перевіряємо чи бізнес існує
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const validated = moduleSchema.parse(moduleData)

    // Створюємо або оновлюємо модуль
    const moduleRow = await prisma.businessModule.upsert({
      where: {
        businessId_moduleKey: {
          businessId,
          moduleKey: validated.moduleKey,
        },
      },
      update: {
        moduleName: validated.moduleName,
        isEnabled: validated.isEnabled ?? true,
        settings: validated.settings ? JSON.stringify(validated.settings) : null,
        metadata: validated.metadata ? JSON.stringify(validated.metadata) : null,
        activatedAt: validated.isEnabled ? new Date() : undefined,
        updatedAt: new Date(),
      },
      create: {
        businessId,
        moduleKey: validated.moduleKey,
        moduleName: validated.moduleName,
        isEnabled: validated.isEnabled ?? true,
        settings: validated.settings ? JSON.stringify(validated.settings) : null,
        metadata: validated.metadata ? JSON.stringify(validated.metadata) : null,
        activatedAt: validated.isEnabled ? new Date() : undefined,
      },
    })

    return NextResponse.json({ module: moduleRow }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Error creating/updating module:', error)
    return NextResponse.json({ error: 'Failed to create/update module' }, { status: 500 })
  }
}

// Видалити модуль
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const moduleKey = searchParams.get('moduleKey')

    if (!businessId || !moduleKey) {
      return NextResponse.json({ error: 'businessId and moduleKey are required' }, { status: 400 })
    }

    await prisma.businessModule.delete({
      where: {
        businessId_moduleKey: {
          businessId,
          moduleKey,
        },
      },
    })

    return NextResponse.json({ message: 'Module deleted successfully' })
  } catch (error) {
    console.error('Error deleting module:', error)
    return NextResponse.json({ error: 'Failed to delete module' }, { status: 500 })
  }
}

