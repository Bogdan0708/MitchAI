/**
 * EMAIL SERVICE TYPES
 * 
 * Types for Gmail integration, priority scoring, and draft generation.
 * Ported from G-mail_Automation project.
 */

// ============================================================================
// ACCOUNT TYPES
// ============================================================================

export interface TenantEmailAccount {
  id: string;
  tenantId: string;
  email: string;
  provider: 'gmail' | 'outlook' | 'other';
  
  // OAuth tokens (encrypted in DB)
  accessToken: string;
  refreshToken: string;
  tokenExpiry: Date;
  
  // Account settings
  enabled: boolean;
  syncEnabled: boolean;
  lastSyncAt: Date | null;
  
  // Metadata
  displayName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailAccountConnection {
  accountId: string;
  email: string;
  provider: 'gmail' | 'outlook';
  connected: boolean;
  lastSync: Date | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  errorMessage?: string;
}

// ============================================================================
// EMAIL TYPES
// ============================================================================

export interface TrackedEmail {
  id: string;                    // Provider message ID
  accountId: string;
  tenantId: string;
  threadId: string;
  
  // Headers
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  subject: string;
  
  // Content
  snippet: string;               // Preview text
  bodyText?: string;             // Plain text body
  bodyHtml?: string;             // HTML body
  
  // Status
  isUnread: boolean;
  isImportant: boolean;
  isStarred: boolean;
  labels: string[];
  
  // AI Processing
  priorityScore: number | null;  // 0-1 scale
  priorityFactors?: PriorityFactors;
  hasDraft: boolean;
  draftId?: string;
  
  // Timestamps
  receivedAt: Date;
  processedAt: Date | null;
}

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface PriorityFactors {
  importance: number;     // 0-1: Gmail importance flags
  senderScore: number;    // 0-1: Known sender, domain reputation
  keywordScore: number;   // 0-1: Urgent keywords in subject
  recencyScore: number;   // 0-1: How recent the email is
  categoryBonus: number;  // 0-1: Finance, booking, etc.
}

// ============================================================================
// DRAFT TYPES
// ============================================================================

export interface EmailDraft {
  id: string;
  emailId: string;         // Original email ID
  accountId: string;
  tenantId: string;
  
  // Draft content
  subject: string;
  bodyHtml: string;
  bodyText: string;
  
  // AI metadata
  generatedBy: string;     // Model used
  tone: DraftTone;
  promptTokens: number;
  completionTokens: number;
  
  // Status
  status: 'generated' | 'edited' | 'sent' | 'discarded';
  sentAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export type DraftTone = 
  | 'professional'
  | 'friendly'
  | 'formal'
  | 'concise'
  | 'detailed';

// ============================================================================
// SCORING TYPES
// ============================================================================

export interface ScoringContext {
  tenantId: string;
  
  // Known entities for scoring boost
  knownSenders: string[];        // Email addresses
  importantDomains: string[];    // e.g., bank domains
  urgentKeywords: string[];      // Custom urgent words
  
  // Business context
  businessType?: string;         // restaurant, hotel, etc.
  businessHours?: BusinessHours;
}

export interface BusinessHours {
  timezone: string;
  openTime: string;   // HH:mm
  closeTime: string;  // HH:mm
  daysOpen: number[]; // 0-6, Sunday = 0
}

export interface ScoringResult {
  score: number;               // 0-1 final score
  factors: PriorityFactors;
  recommendation: 'urgent' | 'important' | 'normal' | 'low';
  reasoning?: string;          // AI explanation
}

// ============================================================================
// DRAFT GENERATION TYPES
// ============================================================================

export interface DraftRequest {
  email: TrackedEmail;
  tone: DraftTone;
  context?: DraftContext;
  maxLength?: number;
}

export interface DraftContext {
  businessName: string;
  businessType: string;
  signatureName: string;
  signatureTitle?: string;
  additionalInstructions?: string;
}

export interface DraftResult {
  draft: EmailDraft;
  confidence: number;           // 0-1 how good the draft is
  suggestedEdits?: string[];    // Things to review
}

// ============================================================================
// NOTIFICATION RULES
// ============================================================================

export interface NotificationRule {
  id: string;
  tenantId: string;
  name: string;
  enabled: boolean;
  
  // Conditions
  conditions: RuleCondition[];
  conditionLogic: 'and' | 'or';
  
  // Actions
  actions: RuleAction[];
  
  // Limits
  cooldownMinutes?: number;     // Don't re-notify within this window
  quietHoursStart?: string;     // HH:mm
  quietHoursEnd?: string;
  
  priority: number;             // Lower = higher priority
}

export interface RuleCondition {
  field: 'priority_score' | 'sender' | 'subject' | 'label' | 'domain';
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'matches';
  value: string | number;
}

export interface RuleAction {
  type: 'notify_telegram' | 'notify_email' | 'notify_webhook' | 'auto_label' | 'auto_star';
  config: Record<string, unknown>;
}

// ============================================================================
// SYNC TYPES
// ============================================================================

export interface SyncOptions {
  accountId: string;
  maxResults?: number;
  labelIds?: string[];
  query?: string;
  pageToken?: string;
}

export interface SyncResult {
  emails: TrackedEmail[];
  nextPageToken?: string;
  totalEmails: number;
  newEmails: number;
  errors: SyncError[];
}

export interface SyncError {
  emailId?: string;
  error: string;
  retryable: boolean;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface ConnectEmailRequest {
  provider: 'gmail' | 'outlook';
  redirectUri: string;
}

export interface ConnectEmailResponse {
  authUrl: string;
  state: string;
}

export interface EmailInboxQuery {
  accountId?: string;
  unreadOnly?: boolean;
  minPriority?: number;
  labels?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

export interface GenerateDraftRequest {
  emailId: string;
  tone?: DraftTone;
  additionalInstructions?: string;
}
