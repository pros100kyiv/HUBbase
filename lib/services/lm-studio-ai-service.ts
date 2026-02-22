import type { AgentDecision, AgentActionType } from './ai-agent-types'

export type { AgentDecision, AgentActionType }

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

interface ChatContext {
  businessName: string
  businessDescription?: string
  services: Array<{ name: string; price: number; duration: number }>
  masters: Array<{ name: string; bio?: string }>
  workingHours?: unknown
  location?: string
}

const LM_STUDIO_MODEL_CACHE_MS = 60_000
let cachedModel: string | null = null
let cacheExpiry = 0

async function getLmStudioModel(baseUrl: string, preferredModel?: string | null): Promise<string> {
  const trimmed = preferredModel?.trim()
  if (trimmed) return trimmed

  const now = Date.now()
  if (cachedModel && now < cacheExpiry) return cachedModel

  const url = `${baseUrl.replace(/\/$/, '')}/models`
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`LM Studio не відповідає (${res.status}). Запустіть LM Studio і завантажте модель. ${errText}`)
  }

  const data = await res.json()
  const models = data?.data ?? []
  const first = Array.isArray(models) ? models[0] : null
  if (!first?.id) throw new Error('Немає завантажених моделей в LM Studio. Завантажте модель у LM Studio.')

  cachedModel = String(first.id)
  cacheExpiry = now + LM_STUDIO_MODEL_CACHE_MS
  return cachedModel
}

async function chatWithLmStudio(
  baseUrl: string,
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options?.temperature ?? 0.2,
    max_tokens: options?.maxTokens ?? 256,
  }
  // LM Studio uses 'json_schema' or 'text', not 'json_object'. Rely on prompt for JSON output.

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`LM Studio error ${res.status}: ${errText}`)
  }

  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`LM Studio повернув не JSON: ${text.slice(0, 200)}`)
  }
  const content = (json as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content
  return typeof content === 'string' ? content : ''
}

function extractFirstJsonObject(text: string): string | null {
  if (!text) return null
  const cleaned = String(text)
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')

  const start = cleaned.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]!
    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth += 1
    if (ch === '}') depth -= 1
    if (depth === 0) return cleaned.slice(start, i + 1)
  }
  return null
}

function parseAgentDecision(rawText: string): AgentDecision | null {
  const jsonCandidate = extractFirstJsonObject(rawText)
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
      'update_client',
      'delete_client',
      'update_master',
      'delete_master',
      'update_service',
      'update_appointment',
      'reschedule_appointment',
      'cancel_appointment',
      'delete_service',
      'add_client_tag',
      'remove_client_tag',
      'send_sms',
      'create_segment',
      'update_segment',
      'delete_segment',
      'update_note',
      'delete_note',
      'update_reminder',
      'delete_reminder',
      'update_business',
      'update_business_working_hours',
      'update_master_working_hours',
      'set_master_date_override',
      'clear_master_date_override',
      'tool_call',
    ]

    const action = typeof parsed.action === 'string' ? parsed.action : 'reply'
    if (!allowedActions.includes(action as AgentActionType)) return null

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
            'Не зовсім зрозумів — можу показати KPI, записи, хто працює, вільні слоти, клієнтів, нотатки, нагадування чи інбокс. Напиши, що потрібно.',
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

function buildAgentPrompt(
  userMessage: string,
  context: ChatContext,
  chatHistory: Array<{ role: string; message: string }>,
  toolContext?: string
): string {
  const historyText = chatHistory
    .slice(-4)
    .map((m) => `${m.role}: ${m.message}`)
    .join('\n')
  const services = context.services.map((s) => s.name).join(', ') || '-'
  const masters = context.masters.map((m) => m.name).join(', ') || '-'

  return `Ти Jarvis — асистент бізнесу "${context.businessName}". Спілкуйся як жива людина: тепло, просто, по-дружньому. Відповідай людськими словами, без офіційщини та роботизмів. Знаєш усе про цей бізнес і вмієш усе — записи, клієнти, KPI, нотатки, нагадування, графіки, платежі, інбокс. Якщо треба дані — викликай tool_call. Якщо достатньо відповісти — пиши reply людською мовою, коротко і по суті (1-3 речення).

Формат відповіді — ТІЛЬКИ JSON, без markdown:
{"action":"reply" або "tool_call","reply":"твій текст українською","confidence":0.9,"tool":{"name":"...","args":{}}}
actions: reply | tool_call | create_note | create_reminder | create_appointment | create_client | create_service | create_master | update_client | delete_client | update_master | delete_master | update_service | update_appointment | reschedule_appointment | cancel_appointment | add_client_tag | remove_client_tag | send_sms | update_business | update_business_working_hours | update_master_working_hours

tools: biz_overview,analytics_kpi,appointments_stats,appointments_list,masters_top,services_top,clients_search,client_by_phone,client_history,segments_list,notes_list,reminders_list,social_inbox_summary,payments_kpi,schedule_overview,who_working,free_slots,gaps_summary
Послуги: ${services}. Майстри: ${masters}.

ДАНІ (TOOL_CONTEXT):
${(toolContext || '(empty)').slice(0, 3000)}

Попередні повідомлення: ${historyText || 'немає'}

Користувач пише: ${userMessage}`
}

export class LmStudioChatService {
  private baseUrl: string
  private preferredModel: string | null

  constructor(baseUrl: string, preferredModel?: string | null) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    if (!this.baseUrl.endsWith('/v1')) this.baseUrl = `${this.baseUrl}/v1`
    this.preferredModel = preferredModel?.trim() || null
  }

  async getAgentDecision(
    userMessage: string,
    context: ChatContext,
    chatHistory: Array<{ role: string; message: string }> = [],
    toolContext?: string
  ): Promise<AgentDecision | null> {
    const model = await getLmStudioModel(this.baseUrl, this.preferredModel)
    const prompt = buildAgentPrompt(userMessage, context, chatHistory, toolContext)

    const messages = [{ role: 'user' as const, content: prompt }]

    const raw = await chatWithLmStudio(this.baseUrl, model, messages, {
      temperature: 0.35,
      maxTokens: 220,
      jsonMode: true,
    })

    const parsed = parseAgentDecision(raw)
    if (parsed) return parsed
    // LM Studio returned non-JSON or malformed — use raw as reply if it looks like text, else fallback
    const trimmed = String(raw || '').trim()
    if (trimmed.length > 0 && trimmed.length < 2000) {
      return {
        action: 'reply',
        reply: trimmed,
        confidence: 0.5,
        needsConfirmation: false,
      }
    }
    return {
      action: 'reply',
      reply: 'Зараз я не на зв’язку — перевір, чи запущено LM Studio і чи завантажена модель. Потім спробуй ще раз.',
      confidence: 0.3,
      needsConfirmation: false,
    }
  }
}
