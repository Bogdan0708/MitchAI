/**
 * Multi-Agent Types
 * Types and interfaces for tenant AI agents
 */

export type AgentStatus = 'inactive' | 'active' | 'paused' | 'error';
export type AgentChannel = 'telegram' | 'whatsapp' | 'webchat';
export type ConversationStatus = 'active' | 'resolved' | 'escalated' | 'archived';
export type MessageRole = 'user' | 'assistant' | 'system';
export type ModelPreference = 'local' | 'anthropic' | 'openai' | 'auto';

export interface AgentCapabilities {
  can_view_menu: boolean;
  can_view_hours: boolean;
  can_handle_reservations: boolean;
  can_process_orders: boolean;
  can_access_loyalty: boolean;
  languages: string[];
}

export interface AgentKnowledge {
  faqs?: Array<{ question: string; answer: string }>;
  policies?: Record<string, string>;
  custom_instructions?: string;
}

export interface TenantAgent {
  id: string;
  tenant_id: string;
  name: string;
  avatar_url?: string;
  system_prompt?: string;
  model_preference: ModelPreference;
  temperature: number;
  max_tokens: number;
  capabilities: AgentCapabilities;
  custom_knowledge: AgentKnowledge;
  menu_context_enabled: boolean;
  daily_message_limit: number;
  monthly_token_limit: number;
  messages_today: number;
  tokens_this_month: number;
  status: AgentStatus;
  error_message?: string;
  last_active_at?: Date;
  created_at: Date;
  updated_at: Date;
  // Channel info (decrypted)
  telegram_bot_username?: string;
  has_telegram: boolean;
  has_whatsapp: boolean;
}

export interface CreateAgentInput {
  name?: string;
  avatar_url?: string;
  system_prompt?: string;
  model_preference?: ModelPreference;
  temperature?: number;
  max_tokens?: number;
  capabilities?: Partial<AgentCapabilities>;
  custom_knowledge?: AgentKnowledge;
  menu_context_enabled?: boolean;
}

export interface UpdateAgentInput extends Partial<CreateAgentInput> {
  status?: AgentStatus;
}

export interface ConfigureChannelInput {
  channel: 'telegram' | 'whatsapp';
  telegram_bot_token?: string;
  telegram_bot_username?: string;
  whatsapp_phone_id?: string;
  whatsapp_access_token?: string;
}

export interface AgentConversation {
  id: string;
  agent_id: string;
  channel: AgentChannel;
  external_chat_id: string;
  customer_name?: string;
  customer_phone?: string;
  context: Record<string, unknown>;
  summary?: string;
  message_count: number;
  last_message_at?: Date;
  status: ConversationStatus;
  escalated_to_human: boolean;
  escalation_reason?: string;
  created_at: Date;
}

export interface AgentMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  tokens_used: number;
  model_used?: string;
  latency_ms?: number;
  external_message_id?: string;
  created_at: Date;
}

export interface AgentAnalytics {
  id: string;
  agent_id: string;
  date: Date;
  total_messages: number;
  total_conversations: number;
  new_conversations: number;
  resolved_conversations: number;
  escalated_conversations: number;
  tokens_used: number;
  local_llm_tokens: number;
  cloud_tokens: number;
  estimated_cost_usd: number;
  avg_response_time_ms?: number;
  avg_messages_per_conversation?: number;
  positive_feedback: number;
  negative_feedback: number;
}

export interface AgentStats {
  messages_today: number;
  messages_limit: number;
  tokens_this_month: number;
  tokens_limit: number;
  active_conversations: number;
  total_conversations: number;
  avg_response_time_ms?: number;
}

export interface ChatRequest {
  conversation_id?: string;
  channel: AgentChannel;
  external_chat_id: string;
  customer_name?: string;
  message: string;
  external_message_id?: string;
}

export interface ChatResponse {
  conversation_id: string;
  message: string;
  tokens_used: number;
  model_used: string;
  latency_ms: number;
  escalated?: boolean;
  escalation_reason?: string;
}
