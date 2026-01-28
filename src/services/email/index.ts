/**
 * EMAIL SERVICE MODULE
 * 
 * Multi-account Gmail integration with AI-powered features:
 * - Connect tenant Gmail accounts via OAuth
 * - Sync and track inbound emails
 * - AI priority scoring
 * - AI draft generation
 * 
 * Ported from G-mail_Automation project.
 */

// Types
export * from './types';

// Gmail Client
export { 
  GmailClient, 
  GmailAPIError, 
  RateLimitError,
  getAuthUrl,
  exchangeCodeForTokens,
  getUserEmail
} from './gmail-client';

// Priority Scorer
export { 
  PriorityScorer, 
  getPriorityScorer 
} from './priority-scorer';

// Draft Generator
export { 
  DraftGenerator, 
  getDraftGenerator 
} from './draft-generator';
