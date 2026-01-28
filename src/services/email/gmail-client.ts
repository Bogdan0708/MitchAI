/**
 * GMAIL API CLIENT
 * 
 * Low-level Gmail API wrapper with rate limiting and error handling.
 * Ported from G-mail_Automation project (Python → TypeScript).
 * 
 * Each tenant can connect their own Gmail account(s).
 */

import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { 
  TrackedEmail, 
  EmailAddress, 
  SyncOptions, 
  SyncResult,
  SyncError 
} from './types';
import { logger } from '../logger.service';

// ============================================================================
// CONFIGURATION
// ============================================================================

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.labels',
];

const DEFAULT_HEADERS = ['From', 'To', 'Cc', 'Subject', 'Date'];

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class GmailAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public accountId: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'GmailAPIError';
  }
}

export class RateLimitError extends GmailAPIError {
  constructor(message: string, accountId: string) {
    super(message, 429, accountId, true);
    this.name = 'RateLimitError';
  }
}

// ============================================================================
// GMAIL CLIENT
// ============================================================================

export class GmailClient {
  private gmail: gmail_v1.Gmail;
  private oauth2Client: OAuth2Client;
  private userId = 'me';
  
  constructor(
    private accountId: string,
    private tenantId: string,
    credentials: Credentials,
    clientId: string,
    clientSecret: string
  ) {
    this.oauth2Client = new OAuth2Client(clientId, clientSecret);
    this.oauth2Client.setCredentials(credentials);
    
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  // -------------------------------------------------------------------------
  // Token Management
  // -------------------------------------------------------------------------

  /**
   * Get current credentials (may have refreshed access token)
   */
  getCredentials(): Credentials {
    return this.oauth2Client.credentials;
  }

  /**
   * Check if token needs refresh
   */
  async ensureValidToken(): Promise<boolean> {
    const creds = this.oauth2Client.credentials;
    
    if (!creds.expiry_date) return true;
    
    // Refresh if expiring within 5 minutes
    const expiresIn = creds.expiry_date - Date.now();
    if (expiresIn < 5 * 60 * 1000) {
      try {
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        this.oauth2Client.setCredentials(credentials);
        return true;
      } catch (error) {
        logger.error('Failed to refresh Gmail token', { 
          accountId: this.accountId, 
          error 
        });
        return false;
      }
    }
    
    return true;
  }

  // -------------------------------------------------------------------------
  // Error Handling
  // -------------------------------------------------------------------------

  private handleError(error: unknown, operation: string): never {
    if (error instanceof Error && 'code' in error) {
      const code = (error as { code: number }).code;
      
      if (code === 429) {
        throw new RateLimitError(
          `Rate limit exceeded during ${operation}`,
          this.accountId
        );
      }
      
      if (code === 401) {
        throw new GmailAPIError(
          `Authentication expired during ${operation}`,
          401,
          this.accountId,
          false
        );
      }
      
      if (code === 403) {
        throw new GmailAPIError(
          `Permission denied during ${operation}`,
          403,
          this.accountId,
          false
        );
      }
      
      if (code === 404) {
        throw new GmailAPIError(
          `Resource not found during ${operation}`,
          404,
          this.accountId,
          false
        );
      }
      
      throw new GmailAPIError(
        `Gmail API error during ${operation}: ${error.message}`,
        code,
        this.accountId,
        code >= 500
      );
    }
    
    throw new GmailAPIError(
      `Unknown error during ${operation}: ${error}`,
      500,
      this.accountId,
      true
    );
  }

  // -------------------------------------------------------------------------
  // Message Operations
  // -------------------------------------------------------------------------

  /**
   * List messages matching a query
   */
  async listMessages(options: {
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    includeSpamTrash?: boolean;
    pageToken?: string;
  } = {}): Promise<{ messages: gmail_v1.Schema$Message[]; nextPageToken?: string }> {
    const {
      query = '',
      maxResults = 100,
      labelIds,
      includeSpamTrash = false,
      pageToken
    } = options;

    try {
      await this.ensureValidToken();
      
      const response = await this.gmail.users.messages.list({
        userId: this.userId,
        q: query,
        maxResults: Math.min(maxResults, 500),
        labelIds,
        includeSpamTrash,
        pageToken
      });

      return {
        messages: response.data.messages || [],
        nextPageToken: response.data.nextPageToken || undefined
      };
    } catch (error) {
      this.handleError(error, 'listMessages');
    }
  }

  /**
   * Get a single message by ID
   */
  async getMessage(
    messageId: string,
    format: 'full' | 'minimal' | 'raw' | 'metadata' = 'full',
    metadataHeaders?: string[]
  ): Promise<gmail_v1.Schema$Message> {
    try {
      await this.ensureValidToken();
      
      const response = await this.gmail.users.messages.get({
        userId: this.userId,
        id: messageId,
        format,
        metadataHeaders: metadataHeaders || DEFAULT_HEADERS
      });

      return response.data;
    } catch (error) {
      this.handleError(error, `getMessage(${messageId})`);
    }
  }

  /**
   * Get multiple messages (with error handling per message)
   */
  async getMessagesBatch(
    messageIds: string[],
    format: 'full' | 'minimal' | 'raw' | 'metadata' = 'metadata'
  ): Promise<{ messages: gmail_v1.Schema$Message[]; errors: SyncError[] }> {
    const messages: gmail_v1.Schema$Message[] = [];
    const errors: SyncError[] = [];

    for (const msgId of messageIds) {
      try {
        const msg = await this.getMessage(msgId, format);
        messages.push(msg);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({
          emailId: msgId,
          error: errorMsg,
          retryable: error instanceof GmailAPIError && error.retryable
        });
        logger.warn(`Failed to get message ${msgId}`, { error: errorMsg });
      }
    }

    return { messages, errors };
  }

  /**
   * Modify labels on a message
   */
  async modifyMessage(
    messageId: string,
    addLabels?: string[],
    removeLabels?: string[]
  ): Promise<gmail_v1.Schema$Message> {
    try {
      await this.ensureValidToken();
      
      const response = await this.gmail.users.messages.modify({
        userId: this.userId,
        id: messageId,
        requestBody: {
          addLabelIds: addLabels || [],
          removeLabelIds: removeLabels || []
        }
      });

      return response.data;
    } catch (error) {
      this.handleError(error, `modifyMessage(${messageId})`);
    }
  }

  /**
   * Mark as read
   */
  async markAsRead(messageId: string): Promise<gmail_v1.Schema$Message> {
    return this.modifyMessage(messageId, undefined, ['UNREAD']);
  }

  /**
   * Mark as unread
   */
  async markAsUnread(messageId: string): Promise<gmail_v1.Schema$Message> {
    return this.modifyMessage(messageId, ['UNREAD']);
  }

  /**
   * Star a message
   */
  async starMessage(messageId: string): Promise<gmail_v1.Schema$Message> {
    return this.modifyMessage(messageId, ['STARRED']);
  }

  /**
   * Unstar a message
   */
  async unstarMessage(messageId: string): Promise<gmail_v1.Schema$Message> {
    return this.modifyMessage(messageId, undefined, ['STARRED']);
  }

  /**
   * Trash a message
   */
  async trashMessage(messageId: string): Promise<gmail_v1.Schema$Message> {
    try {
      await this.ensureValidToken();
      
      const response = await this.gmail.users.messages.trash({
        userId: this.userId,
        id: messageId
      });

      return response.data;
    } catch (error) {
      this.handleError(error, `trashMessage(${messageId})`);
    }
  }

  // -------------------------------------------------------------------------
  // Draft Operations
  // -------------------------------------------------------------------------

  /**
   * Create a draft reply
   */
  async createDraft(
    to: string,
    subject: string,
    body: string,
    options: {
      threadId?: string;
      inReplyTo?: string;
      isHtml?: boolean;
    } = {}
  ): Promise<gmail_v1.Schema$Draft> {
    try {
      await this.ensureValidToken();
      
      const { threadId, inReplyTo, isHtml = true } = options;

      // Build the email message
      const headers: string[] = [
        `To: ${to}`,
        `Subject: ${subject}`,
        `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`
      ];

      if (inReplyTo) {
        headers.push(`In-Reply-To: ${inReplyTo}`);
        headers.push(`References: ${inReplyTo}`);
      }

      const email = [...headers, '', body].join('\r\n');
      const encodedEmail = Buffer.from(email).toString('base64url');

      const response = await this.gmail.users.drafts.create({
        userId: this.userId,
        requestBody: {
          message: {
            raw: encodedEmail,
            threadId
          }
        }
      });

      return response.data;
    } catch (error) {
      this.handleError(error, 'createDraft');
    }
  }

  /**
   * List drafts
   */
  async listDrafts(maxResults = 50): Promise<gmail_v1.Schema$Draft[]> {
    try {
      await this.ensureValidToken();
      
      const response = await this.gmail.users.drafts.list({
        userId: this.userId,
        maxResults
      });

      return response.data.drafts || [];
    } catch (error) {
      this.handleError(error, 'listDrafts');
    }
  }

  /**
   * Send a draft
   */
  async sendDraft(draftId: string): Promise<gmail_v1.Schema$Message> {
    try {
      await this.ensureValidToken();
      
      const response = await this.gmail.users.drafts.send({
        userId: this.userId,
        requestBody: { id: draftId }
      });

      return response.data;
    } catch (error) {
      this.handleError(error, `sendDraft(${draftId})`);
    }
  }

  // -------------------------------------------------------------------------
  // Label Operations
  // -------------------------------------------------------------------------

  /**
   * List all labels
   */
  async listLabels(): Promise<gmail_v1.Schema$Label[]> {
    try {
      await this.ensureValidToken();
      
      const response = await this.gmail.users.labels.list({
        userId: this.userId
      });

      return response.data.labels || [];
    } catch (error) {
      this.handleError(error, 'listLabels');
    }
  }

  /**
   * Create a label
   */
  async createLabel(
    name: string,
    options: {
      backgroundColor?: string;
      textColor?: string;
      visibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide';
    } = {}
  ): Promise<gmail_v1.Schema$Label> {
    try {
      await this.ensureValidToken();
      
      const response = await this.gmail.users.labels.create({
        userId: this.userId,
        requestBody: {
          name,
          labelListVisibility: options.visibility || 'labelShow',
          messageListVisibility: 'show',
          color: options.backgroundColor ? {
            backgroundColor: options.backgroundColor,
            textColor: options.textColor || '#000000'
          } : undefined
        }
      });

      return response.data;
    } catch (error) {
      this.handleError(error, `createLabel(${name})`);
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Parse email message to TrackedEmail
   */
  parseMessage(msg: gmail_v1.Schema$Message): TrackedEmail {
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string): string => 
      headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const parseAddress = (raw: string): EmailAddress => {
      const match = raw.match(/(?:"?([^"]*)"?\s)?(?:<)?([^>]+@[^>]+)(?:>)?/);
      if (match) {
        return { name: match[1]?.trim(), email: match[2] };
      }
      return { email: raw };
    };

    const parseAddressList = (raw: string): EmailAddress[] => {
      if (!raw) return [];
      return raw.split(',').map(s => parseAddress(s.trim()));
    };

    // Get body content
    let bodyText = '';
    let bodyHtml = '';
    
    const extractBody = (part: gmail_v1.Schema$MessagePart) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText = Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
      if (part.parts) {
        part.parts.forEach(extractBody);
      }
    };
    
    if (msg.payload) {
      extractBody(msg.payload);
    }

    const labels = msg.labelIds || [];

    return {
      id: msg.id || '',
      accountId: this.accountId,
      tenantId: this.tenantId,
      threadId: msg.threadId || '',
      
      from: parseAddress(getHeader('From')),
      to: parseAddressList(getHeader('To')),
      cc: parseAddressList(getHeader('Cc')),
      subject: getHeader('Subject'),
      
      snippet: msg.snippet || '',
      bodyText: bodyText || undefined,
      bodyHtml: bodyHtml || undefined,
      
      isUnread: labels.includes('UNREAD'),
      isImportant: labels.includes('IMPORTANT'),
      isStarred: labels.includes('STARRED'),
      labels,
      
      priorityScore: null,
      hasDraft: false,
      
      receivedAt: new Date(parseInt(msg.internalDate || '0', 10)),
      processedAt: null
    };
  }

  /**
   * Sync emails from inbox
   */
  async syncInbox(options: SyncOptions): Promise<SyncResult> {
    const errors: SyncError[] = [];
    
    try {
      // List messages
      const { messages: stubs, nextPageToken } = await this.listMessages({
        query: options.query || 'in:inbox',
        maxResults: options.maxResults || 50,
        labelIds: options.labelIds,
        pageToken: options.pageToken
      });

      if (stubs.length === 0) {
        return {
          emails: [],
          nextPageToken,
          totalEmails: 0,
          newEmails: 0,
          errors: []
        };
      }

      // Get full messages
      const messageIds = stubs.map(s => s.id).filter(Boolean) as string[];
      const { messages, errors: fetchErrors } = await this.getMessagesBatch(
        messageIds,
        'full'
      );
      errors.push(...fetchErrors);

      // Parse to TrackedEmail
      const emails = messages.map(msg => this.parseMessage(msg));

      return {
        emails,
        nextPageToken,
        totalEmails: stubs.length,
        newEmails: emails.length,
        errors
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({
        error: errorMsg,
        retryable: error instanceof GmailAPIError && error.retryable
      });
      
      return {
        emails: [],
        totalEmails: 0,
        newEmails: 0,
        errors
      };
    }
  }
}

// ============================================================================
// AUTH HELPERS
// ============================================================================

/**
 * Generate OAuth2 authorization URL
 */
export function getAuthUrl(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  state: string
): string {
  const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    state,
    prompt: 'consent'
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<Credentials> {
  const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
  
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Get user's email address from token
 */
export async function getUserEmail(
  credentials: Credentials,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const oauth2Client = new OAuth2Client(clientId, clientSecret);
  oauth2Client.setCredentials(credentials);
  
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  
  return profile.data.emailAddress || '';
}
