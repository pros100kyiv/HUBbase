export class EmailService {
  private provider: string
  private apiKey: string
  private from: string
  private fromName: string
  
  constructor(provider: string, apiKey: string, from: string, fromName: string) {
    this.provider = provider
    this.apiKey = apiKey
    this.from = from
    this.fromName = fromName
  }
  
  async send(to: string, subject: string, html: string): Promise<{success: boolean, messageId?: string}> {
    if (this.provider === 'sendgrid') {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: to }]
          }],
          from: {
            email: this.from,
            name: this.fromName
          },
          subject,
          content: [{
            type: 'text/html',
            value: html
          }]
        })
      })
      
      return {
        success: response.ok,
        messageId: response.headers.get('x-message-id') || undefined
      }
    }
    
    throw new Error(`Unsupported email provider: ${this.provider}`)
  }
  
  async sendBulk(recipients: string[], subject: string, html: string): Promise<{sent: number, failed: number}> {
    let sent = 0
    let failed = 0
    
    for (const email of recipients) {
      try {
        const result = await this.send(email, subject, html)
        if (result.success) sent++
        else failed++
      } catch (error) {
        failed++
      }
    }
    
    return { sent, failed }
  }
}

