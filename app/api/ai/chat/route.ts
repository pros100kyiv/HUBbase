import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AIChatService } from '@/lib/services/ai-chat-service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, message, sessionId } = body
    
    if (!businessId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        services: { where: { isActive: true } },
        masters: { where: { isActive: true } }
      }
    })
    
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }
    
    if (!business.aiChatEnabled || !business.aiApiKey) {
      return NextResponse.json({ error: 'AI chat not configured' }, { status: 400 })
    }
    
    const chatHistory = await prisma.aIChatMessage.findMany({
      where: {
        businessId,
        sessionId: sessionId || 'default'
      },
      orderBy: { createdAt: 'asc' },
      take: 10
    })
    
    const context = {
      businessName: business.name,
      businessDescription: business.description || undefined,
      services: business.services.map(s => ({
        name: s.name,
        price: s.price,
        duration: s.duration
      })),
      masters: business.masters.map(m => ({
        name: m.name,
        bio: m.bio || undefined
      })),
      workingHours: business.workingHours ? JSON.parse(business.workingHours) : undefined,
      location: business.location || undefined
    }
    
    const aiService = new AIChatService(
      business.aiApiKey,
      business.aiSettings ? JSON.parse(business.aiSettings).model || 'gemini-pro' : 'gemini-pro'
    )
    
    const history = chatHistory.map(msg => ({
      role: msg.role,
      message: msg.message
    }))
    
    const response = await aiService.getResponse(message, context, history)
    
    await prisma.aIChatMessage.create({
      data: {
        businessId,
        sessionId: sessionId || 'default',
        role: 'user',
        message,
        metadata: JSON.stringify({ timestamp: new Date().toISOString() })
      }
    })
    
    await prisma.aIChatMessage.create({
      data: {
        businessId,
        sessionId: sessionId || 'default',
        role: 'assistant',
        message: response.message,
        metadata: JSON.stringify({
          tokens: response.tokens,
          timestamp: new Date().toISOString()
        })
      }
    })
    
    return NextResponse.json({
      success: true,
      message: response.message,
      tokens: response.tokens
    })
  } catch (error) {
    console.error('AI Chat API error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to process chat message' 
    }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const sessionId = searchParams.get('sessionId') || 'default'
    
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }
    
    const messages = await prisma.aIChatMessage.findMany({
      where: {
        businessId,
        sessionId
      },
      orderBy: { createdAt: 'asc' }
    })
    
    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Get chat history error:', error)
    return NextResponse.json({ error: 'Failed to get chat history' }, { status: 500 })
  }
}

