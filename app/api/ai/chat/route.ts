import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AIChatService, type AgentDecision } from '@/lib/services/ai-chat-service'
import { isValidUaPhone, normalizeUaPhone } from '@/lib/utils/phone'
import { getBusinessSnapshotText } from '@/lib/services/ai-snapshot'
import { runAiTool, type AiToolName } from '@/lib/services/ai-data-tools'

const DEFAULT_APPOINTMENT_DURATION_MINUTES = 60
const MAX_TOOL_CONTEXT_CHARS = 8000
const MAX_TOOL_LINE_CHARS = 1600
const MAX_TOOL_CALLS = 3

const parseJson = <T>(raw: string | null | undefined, fallback: T): T => {
  if (raw == null || String(raw).trim() === '') return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function parseDateTime(value: unknown): Date | null {
  if (typeof value === 'string' || typeof value === 'number') {
    const dt = new Date(value)
    return Number.isNaN(dt.getTime()) ? null : dt
  }
  return null
}

function toStartOfDay(value: Date): Date {
  const dt = new Date(value)
  dt.setHours(0, 0, 0, 0)
  return dt
}

function safeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, Math.max(0, max - 1)) + '…'
}

function buildToolContext(parts: string[]): string {
  if (parts.length === 0) return ''
  const snapshot = parts[0] || ''
  const rest = parts.slice(1).join('\n')
  const combined = rest ? `${snapshot}\n${rest}` : snapshot
  if (combined.length <= MAX_TOOL_CONTEXT_CHARS) return combined

  // Keep the beginning of snapshot + the newest tool outputs.
  const snapshotKeep = truncateText(snapshot, Math.min(2200, MAX_TOOL_CONTEXT_CHARS))
  const tailBudget = Math.max(0, MAX_TOOL_CONTEXT_CHARS - snapshotKeep.length - 20)
  const tail = combined.slice(-tailBudget)
  return `${snapshotKeep}\n...TRUNCATED...\n${tail}`
}

function buildFallbackDecision(
  message: string,
  business: {
    services: Array<{ id: string; name: string; duration: number }>
  }
): AgentDecision {
  const raw = message.trim()
  const lower = raw.toLowerCase()

  const noteMatch = raw.match(/^(?:note|нотатка|замітка|create note)\s*:\s*(.+)$/i)
  if (noteMatch?.[1]) {
    return {
      action: 'create_note',
      reply: 'Готово, створюю нотатку.',
      confidence: 0.7,
      payload: { text: noteMatch[1].trim() },
    }
  }

  const reminderMatch = raw.match(/^(?:reminder|нагадування)\s*:\s*(.+)$/i)
  if (reminderMatch?.[1]) {
    return {
      action: 'create_reminder',
      reply: 'Готово, створюю нагадування.',
      confidence: 0.7,
      payload: { message: reminderMatch[1].trim(), targetType: 'all' },
    }
  }

  const appointmentMatch = raw.match(
    /^(?:appointment|запис)\s*:\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?:,\s*(.+))?$/i
  )
  if (appointmentMatch) {
    const clientName = appointmentMatch[1].trim()
    const clientPhone = appointmentMatch[2].trim()
    const masterName = appointmentMatch[3].trim()
    const startTime = appointmentMatch[4].trim()
    const serviceName = appointmentMatch[5]?.trim()
    const serviceId = serviceName
      ? business.services.find((s) => s.name.toLowerCase().includes(serviceName.toLowerCase()))?.id
      : undefined

    return {
      action: 'create_appointment',
      reply: 'Готово, створюю запис.',
      confidence: 0.7,
      payload: {
        clientName,
        clientPhone,
        masterName,
        startTime,
        serviceIds: serviceId ? [serviceId] : [],
      },
    }
  }

  if (lower.includes('help') || lower.includes('допом')) {
    return {
      action: 'reply',
      reply:
        'Формати fallback-команд: note: текст; reminder: текст; appointment: Імʼя, +380..., Майстер, 2026-02-16T15:00, Послуга.',
      confidence: 1,
    }
  }

  return {
    action: 'reply',
    reply:
      'AI тимчасово недоступний. Спробуйте: note: ..., reminder: ..., appointment: Імʼя, +380..., Майстер, 2026-02-16T15:00.',
    confidence: 0.2,
  }
}

async function executeAgentAction(params: {
  businessId: string
  message: string
  business: {
    services: Array<{ id: string; name: string; duration: number }>
    masters: Array<{ id: string; name: string }>
  }
  decision: AgentDecision
}): Promise<{ message: string; actionData: Record<string, unknown> | null }> {
  const { businessId, message, business, decision } = params
  const payload = decision.payload || {}

  if (decision.action === 'create_note') {
    let noteText = safeText(payload.text) || safeText(message)
    if (noteText) {
      noteText = noteText.replace(/^(?:note|нотатка|замітка)\s*:\s*/i, '').trim()
    }
    if (!noteText) {
      return {
        message: 'Щоб створити нотатку, напишіть її текст.',
        actionData: { action: 'create_note', status: 'missing_fields', missing: ['text'] },
      }
    }

    const parsedDate = parseDateTime(payload.date)
    const note = await prisma.note.create({
      data: {
        businessId,
        text: noteText,
        date: toStartOfDay(parsedDate || new Date()),
        order: typeof payload.order === 'number' ? payload.order : 0,
      },
      select: { id: true, text: true, date: true, order: true },
    })

    return {
      message: decision.reply || 'Готово, нотатку створено.',
      actionData: { action: 'create_note', status: 'completed', note },
    }
  }

  if (decision.action === 'create_reminder') {
    const reminderMessage = safeText(payload.message) || safeText(message)
    if (!reminderMessage) {
      return {
        message: 'Щоб створити нагадування, потрібен текст нагадування.',
        actionData: { action: 'create_reminder', status: 'missing_fields', missing: ['message'] },
      }
    }

    const targetTypeRaw = safeText(payload.targetType)
    let targetType: 'all' | 'client' = targetTypeRaw === 'client' ? 'client' : 'all'
    let clientId: string | null = null

    const clientPhone = safeText(payload.clientPhone)
    if (clientPhone) {
      const normalizedPhone = normalizeUaPhone(clientPhone)
      const client = await prisma.client.findUnique({
        where: { businessId_phone: { businessId, phone: normalizedPhone } },
        select: { id: true },
      })
      if (client) {
        targetType = 'client'
        clientId = client.id
      }
    }

    if (targetType === 'client' && !clientId) {
      return {
        message: 'Для персонального нагадування потрібен валідний телефон клієнта, який є у базі.',
        actionData: { action: 'create_reminder', status: 'missing_fields', missing: ['clientPhone'] },
      }
    }

    const scheduledAt = parseDateTime(payload.scheduledAt)
    const reminder = await prisma.telegramReminder.create({
      data: {
        businessId,
        message: reminderMessage,
        targetType,
        clientId,
        scheduledAt,
        status: 'pending',
        createdBy: 'ai-agent',
      },
      select: { id: true, targetType: true, scheduledAt: true, status: true },
    })

    return {
      message: decision.reply || 'Готово, нагадування створено.',
      actionData: { action: 'create_reminder', status: 'completed', reminder },
    }
  }

  if (decision.action === 'create_appointment') {
    const payloadMasterId = safeText(payload.masterId)
    const payloadMasterName = safeText(payload.masterName)?.toLowerCase()
    const master = business.masters.find((m) => {
      if (payloadMasterId && m.id === payloadMasterId) return true
      if (payloadMasterName && (m.name.toLowerCase().includes(payloadMasterName) || m.id === payloadMasterName)) return true
      return false
    })

    const clientName = safeText(payload.clientName)
    const clientPhoneRaw = safeText(payload.clientPhone)
    const startTime = parseDateTime(payload.startTime || payload.dateTime)
    if (!master || !clientName || !clientPhoneRaw || !startTime) {
      return {
        message:
          decision.reply ||
          'Для створення запису потрібні: майстер, ім’я клієнта, телефон і час початку.',
        actionData: {
          action: 'create_appointment',
          status: 'missing_fields',
          missing: [
            !master ? 'masterId/masterName' : null,
            !clientName ? 'clientName' : null,
            !clientPhoneRaw ? 'clientPhone' : null,
            !startTime ? 'startTime' : null,
          ].filter(Boolean),
        },
      }
    }

    const clientPhone = normalizeUaPhone(clientPhoneRaw)
    if (!isValidUaPhone(clientPhone)) {
      return {
        message: 'Телефон клієнта некоректний. Вкажіть український номер, наприклад 0671234567.',
        actionData: { action: 'create_appointment', status: 'invalid_phone' },
      }
    }

    const serviceIds = Array.isArray(payload.serviceIds)
      ? payload.serviceIds.filter((s): s is string => typeof s === 'string')
      : []
    const validServiceIds = serviceIds.filter((id) => business.services.some((s) => s.id === id))
    const selectedService = validServiceIds.length > 0
      ? business.services.find((s) => s.id === validServiceIds[0])
      : undefined
    const durationFromPayload =
      typeof payload.durationMinutes === 'number' && payload.durationMinutes > 0
        ? payload.durationMinutes
        : null
    const durationMinutes =
      durationFromPayload || selectedService?.duration || DEFAULT_APPOINTMENT_DURATION_MINUTES
    const endTime = parseDateTime(payload.endTime) || new Date(startTime.getTime() + durationMinutes * 60 * 1000)

    const hasConflict = await prisma.appointment.findFirst({
      where: {
        businessId,
        masterId: master.id,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        status: { notIn: ['Cancelled', 'Скасовано'] },
      },
      select: { id: true },
    })
    if (hasConflict) {
      return {
        message: 'Цей час уже зайнятий. Напишіть інший час, і я запропоную вільні слоти.',
        actionData: { action: 'create_appointment', status: 'time_conflict' },
      }
    }

    const ensuredClient = await prisma.client.upsert({
      where: { businessId_phone: { businessId, phone: clientPhone } },
      create: {
        businessId,
        name: clientName,
        phone: clientPhone,
        email: safeText(payload.clientEmail),
      },
      update: {
        name: clientName,
        ...(safeText(payload.clientEmail) ? { email: safeText(payload.clientEmail) } : {}),
      },
      select: { id: true },
    })

    const appointment = await prisma.appointment.create({
      data: {
        businessId,
        masterId: master.id,
        clientId: ensuredClient.id,
        clientName,
        clientPhone,
        clientEmail: safeText(payload.clientEmail),
        startTime,
        endTime,
        status: 'Confirmed',
        services: JSON.stringify(validServiceIds),
        notes: safeText(payload.notes),
        customServiceName: safeText(payload.customServiceName),
        customPrice: typeof payload.customPrice === 'number' ? payload.customPrice : null,
        isFromBooking: false,
        source: 'ai_agent',
      },
      select: { id: true, startTime: true, endTime: true, masterId: true, status: true },
    })

    return {
      message: decision.reply || 'Готово, запис створено.',
      actionData: { action: 'create_appointment', status: 'completed', appointment },
    }
  }

  return {
    message: decision.reply || 'Готово.',
    actionData: { action: 'reply', status: 'completed' },
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, message, sessionId } = body
    const globalAiApiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()

    if (!businessId || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        services: { where: { isActive: true } },
        masters: { where: { isActive: true } },
      },
    })
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }
    if (!business.aiChatEnabled) {
      return NextResponse.json({ error: 'AI chat is disabled for this business' }, { status: 400 })
    }

    const effectiveApiKey = business.aiApiKey?.trim() || globalAiApiKey || null
    const chatHistory = await prisma.aIChatMessage.findMany({
      where: { businessId, sessionId: sessionId || 'default' },
      orderBy: { createdAt: 'asc' },
      take: 10,
    })

    const context = {
      businessName: business.name,
      businessDescription: business.description || undefined,
      services: business.services.map((s) => ({
        name: s.name,
        price: s.price,
        duration: s.duration,
      })),
      masters: business.masters.map((m) => ({
        name: m.name,
        bio: m.bio || undefined,
      })),
      workingHours: parseJson(business.workingHours, undefined),
      location: business.location || undefined,
    }

    const history = chatHistory.map((msg) => ({ role: msg.role, message: msg.message }))
    const aiSettings = parseJson<{ model?: string }>(business.aiSettings, {})
    const aiService = effectiveApiKey
      ? new AIChatService(effectiveApiKey, aiSettings.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash')
      : null

    let decision: AgentDecision | null = null
    let aiUnavailableReason: string | null = null
    const snapshotText = await getBusinessSnapshotText(businessId)
    const toolContextParts: string[] = [snapshotText]

    if (aiService) {
      try {
        let toolCalls = 0
        while (toolCalls < MAX_TOOL_CALLS) {
          decision = await aiService.getAgentDecision(message, context, history, buildToolContext(toolContextParts))
          if (!decision || decision.action !== 'tool_call' || !decision.tool?.name) break

          const name = decision.tool.name as AiToolName
          const result = await runAiTool(businessId, name, decision.tool.args)
          const line = `TOOL:${result.tool}=${JSON.stringify(result.data)}`
          toolContextParts.push(truncateText(line, MAX_TOOL_LINE_CHARS))
          toolCalls++
        }

        // Ensure we always end with a user-facing reply, even if tool-call limit was reached.
        if (decision?.action === 'tool_call') {
          toolContextParts.push('TOOL_LIMIT_REACHED=true; now reply using existing TOOL_CONTEXT, no more tool_call.')
          decision = await aiService.getAgentDecision(message, context, history, buildToolContext(toolContextParts))
        }
      } catch (error) {
        aiUnavailableReason = error instanceof Error ? error.message : 'AI unavailable'
      }
    } else {
      aiUnavailableReason = 'AI API key is not configured'
    }

    if (!decision) {
      decision = buildFallbackDecision(message, {
        services: business.services.map((s) => ({ id: s.id, name: s.name, duration: s.duration })),
      })
    }

    let assistantMessage = ''
    let tokens: number | undefined
    let actionData: Record<string, unknown> | null = null

    if (decision.action !== 'reply') {
      const actionResult = await executeAgentAction({
        businessId,
        message,
        business: {
          services: business.services.map((s) => ({ id: s.id, name: s.name, duration: s.duration })),
          masters: business.masters.map((m) => ({ id: m.id, name: m.name })),
        },
        decision,
      })
      assistantMessage = actionResult.message
      actionData = actionResult.actionData
    } else {
      // IMPORTANT: for "reply" we trust agent-decision. Do not overwrite with getResponse(),
      // otherwise the model will ignore tools/snapshot and switch to generic "client assistant" mode.
      assistantMessage = decision.reply || 'Ок. Що саме показати: KPI, записи, клієнтів/сегменти, платежі, нотатки або інбокс?'
      actionData = { action: 'reply', status: 'completed', confidence: decision.confidence }
    }

    if (aiUnavailableReason) {
      actionData = {
        ...(actionData || {}),
        mode: 'heuristic_fallback',
        aiUnavailableReason,
      }
    }

    if (!assistantMessage.trim()) {
      assistantMessage = 'Не вдалося обробити запит. Спробуйте ще раз.'
    }

    const sid = sessionId || 'default'
    await prisma.$transaction([
      prisma.aIChatMessage.create({
        data: {
          businessId,
          sessionId: sid,
          role: 'user',
          message,
          metadata: JSON.stringify({ timestamp: new Date().toISOString() }),
        },
      }),
      prisma.aIChatMessage.create({
        data: {
          businessId,
          sessionId: sid,
          role: 'assistant',
          message: assistantMessage,
          metadata: JSON.stringify({
            tokens,
            decisionAction: decision.action,
            actionData,
            timestamp: new Date().toISOString(),
          }),
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: assistantMessage,
      tokens,
      action: actionData,
    })
  } catch (error) {
    console.error('AI Chat API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process chat message' },
      { status: 500 }
    )
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
        sessionId,
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Get chat history error:', error)
    return NextResponse.json({ error: 'Failed to get chat history' }, { status: 500 })
  }
}
