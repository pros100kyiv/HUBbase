export class SMSService {
  private provider: string
  private apiKey: string
  private sender: string
  
  constructor(provider: string, apiKey: string, sender: string) {
    this.provider = provider
    this.apiKey = apiKey
    this.sender = sender
  }
  
  async send(phone: string, message: string): Promise<{success: boolean, messageId?: string}> {
    if (this.provider === 'smsc') {
      const [login, password] = this.apiKey.split(':')
      const response = await fetch('https://smsc.ua/sys/send.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          login,
          psw: password,
          phones: phone,
          mes: message,
          sender: this.sender
        })
      })
      
      const data = await response.text()
      return {
        success: !data.startsWith('ERROR'),
        messageId: data.split('=')[1]?.split(',')[0]
      }
    }
    
    throw new Error(`Unsupported SMS provider: ${this.provider}`)
  }
  
  async sendBulk(recipients: string[], message: string): Promise<{sent: number, failed: number}> {
    let sent = 0
    let failed = 0
    
    for (const phone of recipients) {
      try {
        const result = await this.send(phone, message)
        if (result.success) sent++
        else failed++
      } catch (error) {
        failed++
      }
    }
    
    return { sent, failed }
  }
}

