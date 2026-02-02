import { GoogleGenerativeAI } from '@google/generative-ai'

interface ChatContext {
  businessName: string
  businessDescription?: string
  services: Array<{name: string, price: number, duration: number}>
  masters: Array<{name: string, bio?: string}>
  workingHours?: any
  location?: string
}

export class AIChatService {
  private apiKey: string
  private model: string
  
  constructor(apiKey: string, model: string = 'gemini-pro') {
    this.apiKey = apiKey
    this.model = model
  }
  
  private generateSystemPrompt(context: ChatContext): string {
    return `Ти - AI помічник для бізнесу "${context.businessName}".

${context.businessDescription ? `Опис бізнесу: ${context.businessDescription}` : ''}

Доступні послуги:
${context.services.map(s => `- ${s.name}: ${s.price} грн, тривалість ${s.duration} хв`).join('\n')}

${context.masters.length > 0 ? `Спеціалісти:\n${context.masters.map(m => `- ${m.name}${m.bio ? `: ${m.bio}` : ''}`).join('\n')}` : ''}

${context.workingHours ? `Графік роботи: ${JSON.stringify(context.workingHours)}` : ''}
${context.location ? `Адреса: ${context.location}` : ''}

Твоя задача:
1. Допомагати клієнтам з бронюванням записів
2. Відповідати на питання про послуги, ціни, спеціалістів
3. Пропонувати зручний час для запису
4. Бути ввічливим та професійним
5. Відповідати українською мовою

Важливо:
- Завжди використовуй інформацію з контексту бізнесу
- Якщо не знаєш відповіді - чесно скажи
- Не вигадуй інформацію про послуги або ціни
- Допомагай клієнтам знайти найкращий час для запису`
  }
  
  async getResponse(
    userMessage: string,
    context: ChatContext,
    chatHistory: Array<{role: string, message: string}> = []
  ): Promise<{message: string, tokens?: number}> {
    try {
      const genAI = new GoogleGenerativeAI(this.apiKey)
      const model = genAI.getGenerativeModel({ model: this.model })
      
      const systemPrompt = this.generateSystemPrompt(context)
      
      const history = chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model' as const,
        parts: [{ text: msg.message }]
      }))
      
      const chat = model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }]
          },
          {
            role: 'model',
            parts: [{ text: 'Зрозумів! Я готовий допомогти клієнтам з бронюванням та відповідями на питання.' }]
          },
          ...history
        ]
      })
      
      const result = await chat.sendMessage(userMessage)
      const response = await result.response
      const text = response.text()
      
      return {
        message: text,
        tokens: response.usageMetadata?.totalTokenCount
      }
    } catch (error) {
      console.error('AI Chat error:', error)
      throw new Error('Помилка при обробці запиту. Спробуйте пізніше.')
    }
  }
  
  async quickResponse(userMessage: string, context: ChatContext): Promise<string> {
    const result = await this.getResponse(userMessage, context)
    return result.message
  }
}

