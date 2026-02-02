import * as crypto from 'crypto'

export class PaymentService {
  private provider: string
  private apiKey: string
  private merchantId: string
  
  constructor(provider: string, apiKey: string, merchantId: string) {
    this.provider = provider
    this.apiKey = apiKey
    this.merchantId = merchantId
  }
  
  async createPayment(data: {
    amount: number // в копійках
    currency: string
    description: string
    orderId: string
    returnUrl: string
    clientPhone: string
    clientName: string
  }): Promise<{paymentUrl: string, paymentId: string}> {
    if (this.provider === 'liqpay') {
      const amount = data.amount / 100 // Конвертуємо в гривні
      const description = data.description
      
      const signature = crypto
        .createHash('sha1')
        .update(`${this.apiKey}${amount}${data.currency}${this.merchantId}${data.orderId}${description}${data.returnUrl}`)
        .digest('hex')
      
      const paymentData = {
        version: 3,
        public_key: this.merchantId,
        action: 'pay',
        amount,
        currency: data.currency,
        description,
        order_id: data.orderId,
        result_url: data.returnUrl
      }
      
      const paymentUrl = `https://www.liqpay.ua/api/3/checkout?data=${Buffer.from(JSON.stringify(paymentData)).toString('base64')}&signature=${signature}`
      
      return {
        paymentUrl,
        paymentId: data.orderId
      }
    }
    
    throw new Error(`Unsupported payment provider: ${this.provider}`)
  }
  
  async checkPaymentStatus(paymentId: string): Promise<{status: string, amount?: number}> {
    // Реалізація перевірки статусу
    return { status: 'pending' }
  }
}

