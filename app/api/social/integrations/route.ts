import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    const integrations = await prisma.socialIntegration.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' }
    })

    // Формуємо список інтеграцій
    const integrationsList = integrations.map(integration => ({
      id: integration.platform,
      name: integration.platform.charAt(0).toUpperCase() + integration.platform.slice(1),
      connected: integration.isConnected,
      username: integration.username,
      lastSyncAt: integration.lastSyncAt
    }))

    return NextResponse.json({
      integrations: integrationsList
    })
  } catch (error) {
    console.error('Error fetching integrations:', error)
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 })
  }
}

