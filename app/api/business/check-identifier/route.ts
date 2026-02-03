import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const identifier = searchParams.get('identifier')

    if (!identifier) {
      return NextResponse.json({ error: 'identifier is required' }, { status: 400 })
    }

    const existing = await prisma.business.findUnique({
      where: { businessIdentifier: identifier },
      select: { id: true }
    })

    return NextResponse.json({ exists: !!existing })
  } catch (error) {
    console.error('Error checking identifier:', error)
    return NextResponse.json({ error: 'Failed to check identifier' }, { status: 500 })
  }
}

