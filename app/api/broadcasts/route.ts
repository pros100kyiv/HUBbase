import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SMSService } from '@/lib/services/sms-service'
import { EmailService } from '@/lib/services/email-service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, message, type, targetClients, scheduledAt } = body
    
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        smsProvider: true,
        smsApiKey: true,
        smsSender: true,
        emailProvider: true,
        emailApiKey: true,
        emailFrom: true,
        emailFromName: true,
      },
    })
    
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }
    
    const BROADCAST_LIMIT = 5000
    let recipients: Array<{phone?: string, email?: string, id: string}> = []
    
    if (targetClients === 'all') {
      const clients = await prisma.client.findMany({
        where: { businessId },
        select: { id: true, phone: true, email: true },
        take: BROADCAST_LIMIT,
      })
      recipients = clients.map(c => ({
        id: c.id,
        phone: c.phone,
        email: c.email || undefined
      }))
    } else if (Array.isArray(targetClients)) {
      const clients = await prisma.client.findMany({
        where: {
          id: { in: targetClients },
          businessId
        }
      })
      recipients = clients.map(c => ({
        id: c.id,
        phone: c.phone,
        email: c.email || undefined
      }))
    }
    
    const broadcast = await prisma.broadcast.create({
      data: {
        businessId,
        title: `Розсилка через ${type}`,
        message,
        type,
        targetType: targetClients === 'all' ? 'all' : 'selected',
        targetClients: Array.isArray(targetClients) ? JSON.stringify(targetClients) : null,
        status: scheduledAt ? 'scheduled' : 'draft',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null
      }
    })
    
    if (scheduledAt) {
      return NextResponse.json({ 
        success: true, 
        broadcastId: broadcast.id,
        scheduled: true 
      })
    }
    
    let smsCount = 0
    let emailCount = 0
    let failedCount = 0
    
    if ((type === 'sms' || type === 'both') && business.smsProvider && business.smsApiKey) {
      const smsService = new SMSService(
        business.smsProvider,
        business.smsApiKey,
        business.smsSender || 'Xbase'
      )
      const phones = recipients.map(r => r.phone).filter(Boolean) as string[]
      const result = await smsService.sendBulk(phones, message)
      smsCount = result.sent
      failedCount += result.failed
      
      // Зберігаємо SMS повідомлення в базу даних
      const smsMessages = recipients
        .filter(r => r.phone)
        .map(recipient => ({
          businessId,
          phone: recipient.phone!,
          message,
          status: 'sent' as const,
          clientId: recipient.id,
          broadcastId: broadcast.id
        }))
      
      if (smsMessages.length > 0) {
        await prisma.sMSMessage.createMany({
          data: smsMessages
        })
      }
    }
    
    if ((type === 'email' || type === 'both') && business.emailProvider && business.emailApiKey) {
      const emailService = new EmailService(
        business.emailProvider,
        business.emailApiKey,
        business.emailFrom || 'noreply@xbase.online',
        business.emailFromName || 'Xbase'
      )
      const emails = recipients.map(r => r.email).filter(Boolean) as string[]
      const html = `<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif; padding: 20px;">
        <h2>Повідомлення від ${business.name}</h2>
        <p>${message.replace(/\n/g, '<br>')}</p>
      </div>`
      const result = await emailService.sendBulk(emails, `Повідомлення від ${business.name}`, html)
      emailCount = result.sent
      failedCount += result.failed
    }
    
    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        sentCount: recipients.length,
        failedCount,
        smsCount,
        emailCount
      }
    })
    
    return NextResponse.json({ 
      success: true, 
      broadcastId: broadcast.id,
      smsCount,
      emailCount,
      failedCount
    })
  } catch (error) {
    console.error('Broadcast error:', error)
    return NextResponse.json({ error: 'Failed to send broadcast' }, { status: 500 })
  }
}

