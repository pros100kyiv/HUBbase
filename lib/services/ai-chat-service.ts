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
  | 'create_client'
  | 'create_service'
  | 'create_master'
  | 'update_appointment'
  | 'reschedule_appointment'
  | 'cancel_appointment'
  | 'delete_service'
  | 'add_client_tag'
  | 'send_sms'
  | 'create_segment'
  | 'update_business_working_hours'
  | 'update_master_working_hours'
  | 'set_master_date_override'
  | 'clear_master_date_override'
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
  'schedule_overview',
  'who_working',
  'free_slots',
  'gaps_summary',
])

function normalizeGeminiModelName(model: string): string {
  const raw = (model || '').trim()
  if (!raw) return 'gemini-flash-lite-latest'

  // Allow both "models/..." and plain names.
  const name = raw.startsWith('models/') ? raw.slice('models/'.length) : raw

  // Some projects/keys no longer expose legacy 1.5 names via v1beta ListModels.
  // Treat it as an alias to keep old configs working without breaking chat.
  if (name === 'gemini-1.5-flash') return 'gemini-flash-lite-latest'
  if (name === 'gemini-1.5-pro') return 'gemini-pro-latest'

  return name
}

export class AIChatService {
  private apiKey: string
  private model: string
  
  constructor(apiKey: string, model: string = 'gemini-flash-lite-latest') {
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
        'create_client',
        'create_service',
        'create_master',
        'update_appointment',
        'reschedule_appointment',
        'cancel_appointment',
        'delete_service',
        'add_client_tag',
        'send_sms',
        'create_segment',
        'update_business_working_hours',
        'update_master_working_hours',
        'set_master_date_override',
        'clear_master_date_override',
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
    const requestedModel = normalizeGeminiModelName(this.model)
    const genConfig = {
      responseMimeType: 'application/json' as const,
      temperature: 0.4,
      maxOutputTokens: 256,
    }

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
5) "create_client" - створити/оновити клієнта
6) "create_service" - створити/оновити послугу
7) "create_master" - створити майстра
8) "update_appointment" - редагувати запис (майстер/послуги/нотатки/клієнтські поля)
9) "reschedule_appointment" - перенести запис на інший час
10) "cancel_appointment" - скасувати запис
11) "delete_service" - вимкнути (soft-delete) послугу
12) "add_client_tag" - додати тег клієнту
13) "send_sms" - надіслати SMS (якщо налаштований SMS провайдер)
14) "create_segment" - створити сегмент клієнтів
15) "tool_call" - отримати дані з системи (аналітика/клієнти/записи) мінімальним обсягом
16) "update_business_working_hours" - оновити тижневий графік роботи бізнесу
17) "update_master_working_hours" - оновити тижневий графік роботи майстра
18) "set_master_date_override" - задати виключення графіку майстра на конкретну дату
19) "clear_master_date_override" - прибрати виключення графіку майстра на дату

Формат JSON:
{
  "action": "reply | create_note | create_reminder | create_appointment | create_client | create_service | create_master | update_appointment | reschedule_appointment | cancel_appointment | delete_service | add_client_tag | send_sms | create_segment | tool_call",
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
- Якщо користувач просить поради/покращення/збільшення прибутку — зроби 1-3 tool_call (analytics_kpi, payments_kpi, services_top, masters_top, appointments_stats) і потім дай 3-7 коротких конкретних порад з числами/гіпотезами.
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
- schedule_overview: {}
- who_working: { date?: string(YYYY-MM-DD) }
- free_slots: { date?: string(YYYY-MM-DD), masterId?: string, masterName?: string, durationMinutes?: number, limit?: number }
- gaps_summary: { date?: string(YYYY-MM-DD), masterId?: string, masterName?: string, minGapMinutes?: number, limit?: number }

Поля payload для actions:
- create_client.payload: { name: string, phone: string, email?: string, notes?: string }
- create_service.payload: { name: string, price: number, duration: number, category?: string, subcategory?: string, description?: string }
- create_appointment.payload: { clientName: string, clientPhone: string, clientEmail?: string, masterName: string, serviceNames?: string[], startTime: string(ISO), durationMinutes?: number, notes?: string, customServiceName?: string, customPrice?: number }
- create_master.payload: { name: string, bio?: string, photo?: string, workingHoursJson?: string }
- cancel_appointment.payload: { appointmentId?: string, clientPhone?: string, startTime?: string(ISO) }
- reschedule_appointment.payload: { appointmentId?: string, clientPhone?: string, oldStartTime?: string(ISO), newStartTime: string(ISO), durationMinutes?: number }
- update_appointment.payload: { appointmentId?: string, clientPhone?: string, startTime?: string(ISO), masterName?: string, masterId?: string, serviceIds?: string[], notes?: string, status?: string }
- delete_service.payload: { serviceId?: string, name?: string }
- add_client_tag.payload: { clientId?: string, clientPhone?: string, tag: string }
- send_sms.payload: { phone?: string, clientPhone?: string, message: string }
- create_segment.payload: { name: string, criteria: object|string, autoUpdate?: boolean }
- update_business_working_hours.payload: { workingHours: object|string(JSON) }
- update_master_working_hours.payload: { masterId?: string, masterName?: string, workingHours: object|string(JSON) }
- set_master_date_override.payload: { masterId?: string, masterName?: string, date: string(YYYY-MM-DD), enabled: boolean, start?: string(HH:mm), end?: string(HH:mm) }
- clear_master_date_override.payload: { masterId?: string, masterName?: string, date: string(YYYY-MM-DD) }

TOOL_CONTEXT (стислі дані з БД, якщо вже є):
${toolContext ? toolContext : '(empty)'}

Останні повідомлення:
${historyText || 'немає'}

Нове повідомлення користувача:
${userMessage}
`

    const tryModels = Array.from(
      new Set<string>(
        [
          requestedModel,
          // Lightweight + usually most available on free tier.
          'gemini-flash-lite-latest',
          'gemini-flash-latest',
          // Stable explicit versions.
          'gemini-2.0-flash',
          'gemini-2.5-flash',
        ].filter(Boolean)
      )
    )

    let lastErr: unknown = null
    let bestTextReply: string | null = null
    for (const m of tryModels) {
      try {
        // Force JSON to avoid parse failures -> fewer fallbacks and clearer "AI used" signal.
        const model = genAI.getGenerativeModel({ model: m, generationConfig: genConfig })
        const result = await model.generateContent(prompt)
        const response = await result.response
        const raw = response.text()
        const parsed = this.parseAgentDecision(raw)
        if (parsed) return parsed
        const trimmed = (raw || '').trim()
        if (trimmed && !bestTextReply) bestTextReply = trimmed

        // Unparseable output: try next model in the list (some models ignore responseMimeType).
        throw new Error('AI returned non-JSON response')
      } catch (e) {
        lastErr = e
        const msg = e instanceof Error ? e.message : String(e)
        const isNonJson = msg.includes('non-JSON response')
        const isModelNotFound =
          msg.includes('is not found') ||
          msg.includes('404') ||
          msg.includes('not supported for generateContent')
        // If it's not a "model not found" and not a JSON-format issue, don't keep retrying blindly.
        if (!isModelNotFound && !isNonJson) break
      }
    }

    if (bestTextReply) {
      return {
        action: 'reply',
        reply: bestTextReply,
        confidence: 0.35,
        needsConfirmation: false,
      }
    }

    throw lastErr instanceof Error ? lastErr : new Error('AI unavailable')
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

