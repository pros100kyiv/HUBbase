import { GoogleGenerativeAI } from '@google/generative-ai'

interface ChatContext {
  businessName: string
  businessDescription?: string
  services: Array<{name: string, price: number, duration: number}>
  masters: Array<{name: string, bio?: string}>
  workingHours?: any
  location?: string
}

export type AgentActionType =
  | 'reply'
  | 'create_note'
  | 'create_reminder'
  | 'create_appointment'
  | 'tool_call'

export interface AgentDecision {
  action: AgentActionType
  reply: string
  confidence?: number
  needsConfirmation?: boolean
  payload?: Record<string, unknown>
  tool?: { name: string; args?: Record<string, unknown> }
}

const ALLOWED_TOOL_NAMES = new Set<string>([
  'biz_overview',
  'analytics_kpi',
  'appointments_stats',
  'appointments_list',
  'clients_search',
  'client_by_phone',
  'client_history',
  'segments_list',
  'notes_list',
  'reminders_list',
  'social_inbox_summary',
  'payments_kpi',
  'services_top',
  'masters_top',
])

export class AIChatService {
  private apiKey: string
  private model: string
  
  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
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

  private extractFirstJsonObject(text: string): string | null {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    return text.slice(start, end + 1)
  }

  private parseAgentDecision(rawText: string): AgentDecision | null {
    const jsonCandidate = this.extractFirstJsonObject(rawText)
    if (!jsonCandidate) return null

    try {
      const parsed = JSON.parse(jsonCandidate) as {
        action?: unknown
        reply?: unknown
        confidence?: unknown
        needsConfirmation?: unknown
        payload?: unknown
        tool?: unknown
      }

      const allowedActions: AgentActionType[] = [
        'reply',
        'create_note',
        'create_reminder',
        'create_appointment',
        'tool_call',
      ]

      const action = typeof parsed.action === 'string' ? parsed.action : 'reply'
      if (!allowedActions.includes(action as any)) return null

      const tool =
        parsed.tool && typeof parsed.tool === 'object' && !Array.isArray(parsed.tool)
          ? (parsed.tool as Record<string, unknown>)
          : null

      const toolName = tool && typeof tool.name === 'string' ? tool.name : null
      const toolArgs =
        tool && tool.args && typeof tool.args === 'object' && !Array.isArray(tool.args)
          ? (tool.args as Record<string, unknown>)
          : undefined

      if (action === 'tool_call') {
        if (!toolName || !ALLOWED_TOOL_NAMES.has(toolName)) {
          return {
            action: 'reply',
            reply:
              'Я не можу викликати цей інструмент. Скажи, що саме треба: KPI/аналітика, записи, клієнти/історія, сегменти, платежі, нотатки/нагадування або інбокс.',
            confidence: 0.2,
            needsConfirmation: false,
          }
        }
      }

      return {
        action: action as AgentActionType,
        reply: typeof parsed.reply === 'string' ? parsed.reply : '',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : undefined,
        needsConfirmation: parsed.needsConfirmation === true,
        payload:
          parsed.payload && typeof parsed.payload === 'object' && !Array.isArray(parsed.payload)
            ? (parsed.payload as Record<string, unknown>)
            : undefined,
        tool: toolName ? { name: toolName, args: toolArgs } : undefined,
      }
    } catch {
      return null
    }
  }

  async getAgentDecision(
    userMessage: string,
    context: ChatContext,
    chatHistory: Array<{role: string, message: string}> = [],
    toolContext?: string
  ): Promise<AgentDecision | null> {
    if (!this.apiKey?.trim()) {
      throw new Error('AI API key is missing')
    }

    const genAI = new GoogleGenerativeAI(this.apiKey)
    const model = genAI.getGenerativeModel({ model: this.model })

    const historyText = chatHistory
      .slice(-6)
      .map((m) => `${m.role}: ${m.message}`)
      .join('\n')

    const prompt = `Ти керуючий AI-агент для власника/адміністратора бізнесу "${context.businessName}".
Потрібно повернути СУВОРО валідний JSON без markdown.

Дозволені action:
1) "reply" - лише текстова відповідь
2) "create_note" - створити нотатку
3) "create_reminder" - створити нагадування
4) "create_appointment" - створити запис
5) "tool_call" - отримати дані з системи (аналітика/клієнти/записи) мінімальним обсягом

Формат JSON:
{
  "action": "reply | create_note | create_reminder | create_appointment | tool_call",
  "reply": "коротка відповідь українською для користувача",
  "confidence": 0.0,
  "needsConfirmation": false,
  "payload": {},
  "tool": { "name": "tool_name", "args": {} }
}

Правила:
- Спілкуйся як жива людина: коротко, по суті, без канцеляриту.
- Економ токени: reply здебільшого 1-2 короткі фрази (ідеально до ~250-400 символів). Довгі списки/пояснення — тільки якщо користувач явно просить.
- Завжди намагайся "закривати" задачі по кабінету: записи, клієнти, платежі, інбокс, нотатки/нагадування, сегменти, KPI.
- Якщо запит нечіткий — задай ОДНЕ уточнення або зроби tool_call для швидких цифр і потім уточни.
- Якщо даних не вистачає для дії, став action="reply" та попроси відсутні поля.
- Нічого не вигадуй про час, майстрів або послуги.
- confidence від 0 до 1.
- Якщо потрібно більше даних — використовуй tool_call замість довгих пояснень.
- Не проси "всю базу" — запитуй агрегати або top-N.
- ТИ МАЄШ ДОСТУП до даних через tools і TOOL_CONTEXT. НІКОЛИ не кажи "я не маю доступу до аналітики/даних".
- Якщо користувач питає про KPI/аналітику/причини/статистику — спочатку зроби tool_call (analytics_kpi, appointments_stats).
- Якщо запит не про кабінет (оф-топ) — все одно відповідай ввічливо 1-2 фрази і м'яко поверни до того, чим можеш допомогти в кабінеті.

Контекст бізнесу:
- Послуги: ${context.services.map((s) => `${s.name} (${s.duration} хв, ${s.price} грн)`).join(', ') || 'немає'}
- Майстри: ${context.masters.map((m) => m.name).join(', ') || 'немає'}
- Локація: ${context.location || 'не вказано'}
- Графік: ${context.workingHours ? JSON.stringify(context.workingHours) : 'не вказано'}

Доступні tools (повертай тільки назву та args):
- biz_overview: {}
- analytics_kpi: { days?: number }
- appointments_stats: { days?: number }
- appointments_list: { days?: number, limit?: number, status?: string }
- masters_top: { days?: number, limit?: number }
- services_top: { days?: number, limit?: number }
- clients_search: { q: string, limit?: number }
- client_by_phone: { phone: string }
- client_history: { clientId: string, limit?: number }
- segments_list: {}
- notes_list: { date?: string, limit?: number }
- reminders_list: { status?: string, limit?: number }
- social_inbox_summary: { platform?: string, limit?: number }
- payments_kpi: { days?: number }

TOOL_CONTEXT (стислі дані з БД, якщо вже є):
${toolContext ? toolContext : '(empty)'}

Останні повідомлення:
${historyText || 'немає'}

Нове повідомлення користувача:
${userMessage}
`

    const result = await model.generateContent(prompt)
    const response = await result.response
    return this.parseAgentDecision(response.text())
  }
  
  async getResponse(
    userMessage: string,
    context: ChatContext,
    chatHistory: Array<{role: string, message: string}> = []
  ): Promise<{message: string, tokens?: number}> {
    try {
      if (!this.apiKey?.trim()) {
        throw new Error('AI API key is missing')
      }

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

