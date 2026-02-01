import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    const services = await prisma.service.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(services)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, name, price, duration, category, subcategory } = body

    if (!businessId || !name || !price || !duration) {
      return NextResponse.json(
        { error: 'businessId, name, price, and duration are required' },
        { status: 400 }
      )
    }

    // Конвертуємо ціну з гривень в копійки (користувач вводить в гривнях)
    const priceInCents = Math.round(parseFloat(price) * 100)

    const service = await prisma.service.create({
      data: {
        businessId,
        name,
        price: priceInCents,
        duration: parseInt(duration),
        category: category || null,
        subcategory: subcategory || null,
      },
    })

    return NextResponse.json(service, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
  }
}
