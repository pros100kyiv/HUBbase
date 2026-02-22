/**
 * Спільні типи для AI-агента (Jarvis).
 * Використовується LM Studio.
 */

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
  | 'remove_client_tag'
  | 'send_sms'
  | 'create_segment'
  | 'update_client'
  | 'delete_client'
  | 'update_master'
  | 'delete_master'
  | 'update_service'
  | 'update_note'
  | 'delete_note'
  | 'update_reminder'
  | 'delete_reminder'
  | 'update_segment'
  | 'delete_segment'
  | 'update_business'
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
