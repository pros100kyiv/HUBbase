import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ClientSegmentationService } from '@/lib/services/client-segmentation'

export async function POST(request: Request) {
  try {
    const { businessId } = await request.json()
    await ClientSegmentationService.updateSegments(businessId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Segment update error:', error)
    return NextResponse.json({ error: 'Failed to update segments' }, { status: 500 })
  }
}

