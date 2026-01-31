import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getBusinessBySlug } from '@/lib/business-context'

// Перевіряє чи параметр є UUID (ID) чи slug
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ param: string }> }
) {
  try {
    const resolvedParams = await params
    const { param } = resolvedParams

    let business

    // Якщо це UUID, шукаємо по ID
    if (isUUID(param)) {
      business = await prisma.business.findUnique({
        where: { id: param },
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          phone: true,
          address: true,
          description: true,
          logo: true,
          primaryColor: true,
          secondaryColor: true,
          backgroundColor: true,
          surfaceColor: true,
          hideRevenue: true,
          isActive: true,
        },
      })
    } else {
      // Інакше шукаємо по slug
      business = await getBusinessBySlug(param)
    }

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    return NextResponse.json({ business })
  } catch (error) {
    console.error('Error fetching business:', error)
    return NextResponse.json({ error: 'Failed to fetch business' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ param: string }> }
) {
  try {
    const resolvedParams = await params
    const { param } = resolvedParams

    console.log('PATCH request received with param:', param)
    console.log('Is UUID?', isUUID(param))

    // PATCH тільки для ID
    if (!isUUID(param)) {
      console.error('Invalid business ID format:', param)
      return NextResponse.json({ error: 'Invalid business ID', details: `Expected UUID format, got: ${param}` }, { status: 400 })
    }

    const body = await request.json()
    const { name, email, phone, address, description, primaryColor, secondaryColor, backgroundColor, surfaceColor, hideRevenue } = body

    const business = await prisma.business.update({
      where: { id: param },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(address !== undefined && { address: address || null }),
        ...(description !== undefined && { description: description || null }),
        ...(primaryColor !== undefined && { primaryColor }),
        ...(secondaryColor !== undefined && { secondaryColor }),
        ...(backgroundColor !== undefined && { backgroundColor }),
        ...(surfaceColor !== undefined && { surfaceColor }),
        ...(hideRevenue !== undefined && { hideRevenue }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        address: true,
        description: true,
        logo: true,
        primaryColor: true,
        secondaryColor: true,
        backgroundColor: true,
        surfaceColor: true,
        isActive: true,
      },
    })

    return NextResponse.json({ business })
  } catch (error) {
    console.error('Error updating business:', error)
    return NextResponse.json({ error: 'Failed to update business' }, { status: 500 })
  }
}



