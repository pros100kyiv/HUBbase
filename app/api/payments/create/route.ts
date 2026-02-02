import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PaymentService } from '@/lib/services/payment-service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, appointmentId, amount, description } = body
    
    const business = await prisma.business.findUnique({
      where: { id: businessId }
    })
    
    if (!business?.paymentEnabled || !business.paymentProvider) {
      return NextResponse.json({ error: 'Payments not configured' }, { status: 400 })
    }
    
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId }
    })
    
    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }
    
    const paymentService = new PaymentService(
      business.paymentProvider,
      business.paymentApiKey || '',
      business.paymentMerchantId || ''
    )
    
    const paymentData = await paymentService.createPayment({
      amount: amount * 100,
      currency: 'UAH',
      description: description || `Оплата за запис: ${appointment.clientName}`,
      orderId: `apt_${appointmentId}_${Date.now()}`,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/success?appointmentId=${appointmentId}`,
      clientPhone: appointment.clientPhone,
      clientName: appointment.clientName
    })
    
    const payment = await prisma.payment.create({
      data: {
        businessId,
        appointmentId,
        clientId: appointment.clientId,
        amount: BigInt(amount * 100),
        currency: 'UAH',
        status: 'pending',
        provider: business.paymentProvider,
        providerPaymentId: paymentData.paymentId,
        paymentUrl: paymentData.paymentUrl,
        returnUrl: paymentData.paymentUrl,
        metadata: JSON.stringify({
          appointmentId,
          clientName: appointment.clientName,
          clientPhone: appointment.clientPhone
        })
      }
    })
    
    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      paymentUrl: paymentData.paymentUrl
    })
  } catch (error) {
    console.error('Payment creation error:', error)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}

