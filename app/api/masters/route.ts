import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    const masters = await prisma.master.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        photo: true,
        bio: true,
        rating: true,
        isActive: true,
        workingHours: true,
        scheduleDateOverrides: true,
        blockedPeriods: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json(masters)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch masters' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, name, photo, bio, rating } = body

    console.log('Creating master with data:', { businessId, name, photo, bio, rating })

    if (!businessId || !name) {
      return NextResponse.json({ 
        error: 'businessId and name are required',
        received: { businessId: !!businessId, name: !!name }
      }, { status: 400 })
    }

    // Verify business exists
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })

    if (!business) {
      return NextResponse.json({ 
        error: 'Business not found',
        businessId 
      }, { status: 404 })
    }

    // Prepare data
    const masterData = {
      businessId,
      name: name.trim(),
      photo: photo?.trim() || null,
      bio: bio?.trim() || null,
      rating: rating !== undefined && rating !== null ? parseFloat(rating.toString()) : 0,
      isActive: true, // Default to active
    }

    console.log('Master data to create:', masterData)

    const master = await prisma.master.create({
      data: masterData,
      select: {
        id: true,
        name: true,
        photo: true,
        bio: true,
        rating: true,
        isActive: true,
        workingHours: true,
        scheduleDateOverrides: true,
        blockedPeriods: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    console.log('Master created successfully:', master.id)
    return NextResponse.json(master, { status: 201 })
  } catch (error) {
    console.error('Error creating master:', error)
    
    // More detailed error information
    let errorMessage = 'Failed to create master'
    let errorDetails: any = {}

    if (error instanceof Error) {
      errorMessage = error.message
      errorDetails = {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }

      // Check for Prisma-specific errors
      if (error.message.includes('Unique constraint')) {
        errorMessage = 'Master with this name already exists'
      } else if (error.message.includes('Foreign key constraint')) {
        errorMessage = 'Invalid business ID'
      } else if (error.message.includes('required')) {
        errorMessage = `Missing required field: ${error.message}`
      }
    }

    return NextResponse.json({ 
      error: errorMessage,
      details: errorDetails
    }, { status: 500 })
  }
}
