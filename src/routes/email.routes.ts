/**
 * EMAIL API ROUTES
 * 
 * Endpoints for Gmail integration:
 * - Connect/disconnect email accounts
 * - View inbox with priority scores
 * - Generate AI drafts
 * - Send replies
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import * as crypto from 'crypto';

// Import to trigger type augmentation
import '../middleware/tenant.middleware';
import { 
  GmailClient, 
  getAuthUrl, 
  exchangeCodeForTokens,
  getUserEmail,
  PriorityScorer,
  DraftGenerator
} from '../services/email';
import { AIOrchestrator, getAIOrchestrator } from '../services/ai/orchestrator';
import { logger } from '../services/logger.service';

// ============================================================================
// VALIDATORS
// ============================================================================

const connectEmailSchema = z.object({
  provider: z.enum(['gmail', 'outlook']),
  redirectUri: z.string().url()
});

const oauthCallbackSchema = z.object({
  code: z.string(),
  state: z.string()
});

const inboxQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  unreadOnly: z.coerce.boolean().optional().default(false),
  minPriority: z.coerce.number().min(0).max(1).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0)
});

const generateDraftSchema = z.object({
  tone: z.enum(['professional', 'friendly', 'formal', 'concise', 'detailed']).optional().default('professional'),
  additionalInstructions: z.string().max(500).optional()
});

const regenerateDraftSchema = z.object({
  previousDraft: z.string(),
  feedback: z.string().max(500)
});

// ============================================================================
// STATE STORAGE (In production, use Redis)
// ============================================================================

const oauthStates = new Map<string, { tenantId: string; redirectUri: string; expiresAt: number }>();

// Clean expired states periodically
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(oauthStates.entries());
  for (const [key, value] of entries) {
    if (value.expiresAt < now) {
      oauthStates.delete(key);
    }
  }
}, 60000);

// ============================================================================
// ROUTE FACTORY
// ============================================================================

export function createEmailRoutes(pool: Pool): Router {
  const router = Router();

  // Get config from environment
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

  // -------------------------------------------------------------------------
  // GET /api/email/accounts - List connected email accounts
  // -------------------------------------------------------------------------
  router.get('/accounts', async (req, res, next) => {
    try {
      const tenantId = req.tenant!.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant not authenticated' });
      }

      const result = await pool.query(
        `SELECT id, email, provider, display_name, enabled, sync_enabled,
                last_sync_at, last_sync_status, emails_synced, drafts_generated,
                created_at
         FROM tenant_email_accounts
         WHERE tenant_id = $1
         ORDER BY created_at`,
        [tenantId]
      );

      res.json({
        accounts: result.rows.map(row => ({
          id: row.id,
          email: row.email,
          provider: row.provider,
          displayName: row.display_name,
          enabled: row.enabled,
          syncEnabled: row.sync_enabled,
          lastSyncAt: row.last_sync_at,
          lastSyncStatus: row.last_sync_status,
          emailsSynced: row.emails_synced,
          draftsGenerated: row.drafts_generated,
          createdAt: row.created_at
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/email/connect - Start OAuth flow
  // -------------------------------------------------------------------------
  router.post('/connect', async (req, res, next) => {
    try {
      const tenantId = req.tenant!.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant not authenticated' });
      }

      const body = connectEmailSchema.parse(req.body);

      if (body.provider !== 'gmail') {
        return res.status(400).json({ error: 'Only Gmail is currently supported' });
      }

      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({ error: 'Google OAuth not configured' });
      }

      // Generate state token
      const state = crypto.randomBytes(32).toString('hex');
      oauthStates.set(state, {
        tenantId,
        redirectUri: body.redirectUri,
        expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
      });

      // Generate auth URL
      const authUrl = getAuthUrl(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        body.redirectUri,
        state
      );

      res.json({ authUrl, state });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/email/callback - OAuth callback
  // -------------------------------------------------------------------------
  router.post('/callback', async (req, res, next) => {
    try {
      const body = oauthCallbackSchema.parse(req.body);

      // Validate state
      const stateData = oauthStates.get(body.state);
      if (!stateData) {
        return res.status(400).json({ error: 'Invalid or expired state' });
      }
      oauthStates.delete(body.state);

      if (stateData.expiresAt < Date.now()) {
        return res.status(400).json({ error: 'State expired' });
      }

      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(
        body.code,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        stateData.redirectUri
      );

      if (!tokens.access_token || !tokens.refresh_token) {
        return res.status(400).json({ error: 'Failed to get tokens' });
      }

      // Get user email
      const email = await getUserEmail(tokens, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

      // Check if account already connected
      const existing = await pool.query(
        'SELECT id FROM tenant_email_accounts WHERE tenant_id = $1 AND email = $2',
        [stateData.tenantId, email]
      );

      if (existing.rows.length > 0) {
        // Update existing account
        await pool.query(
          `UPDATE tenant_email_accounts
           SET access_token_encrypted = $1,
               refresh_token_encrypted = $2,
               token_expiry = $3,
               enabled = true,
               updated_at = NOW()
           WHERE id = $4`,
          [
            tokens.access_token, // TODO: Encrypt
            tokens.refresh_token,
            new Date(tokens.expiry_date || Date.now() + 3600000),
            existing.rows[0].id
          ]
        );

        res.json({
          success: true,
          accountId: existing.rows[0].id,
          email,
          isReconnect: true
        });
      } else {
        // Create new account
        const result = await pool.query(
          `INSERT INTO tenant_email_accounts
           (tenant_id, email, provider, access_token_encrypted, refresh_token_encrypted, token_expiry)
           VALUES ($1, $2, 'gmail', $3, $4, $5)
           RETURNING id`,
          [
            stateData.tenantId,
            email,
            tokens.access_token, // TODO: Encrypt
            tokens.refresh_token,
            new Date(tokens.expiry_date || Date.now() + 3600000)
          ]
        );

        res.json({
          success: true,
          accountId: result.rows[0].id,
          email,
          isReconnect: false
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      logger.error('OAuth callback failed', { error });
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // DELETE /api/email/accounts/:id - Disconnect account
  // -------------------------------------------------------------------------
  router.delete('/accounts/:id', async (req, res, next) => {
    try {
      const tenantId = req.tenant!.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant not authenticated' });
      }

      const accountId = req.params.id;

      const result = await pool.query(
        'DELETE FROM tenant_email_accounts WHERE id = $1 AND tenant_id = $2 RETURNING email',
        [accountId, tenantId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }

      res.json({ success: true, email: result.rows[0].email });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/email/inbox - Get emails with priority scores
  // -------------------------------------------------------------------------
  router.get('/inbox', async (req, res, next) => {
    try {
      const tenantId = req.tenant!.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant not authenticated' });
      }

      const query = inboxQuerySchema.parse(req.query);

      let sql = `
        SELECT te.id, te.account_id, te.thread_id,
               te.from_email, te.from_name, te.subject, te.snippet,
               te.is_unread, te.is_important, te.is_starred,
               te.priority_score, te.priority_recommendation,
               te.has_draft, te.received_at,
               tea.email as account_email
        FROM tracked_emails te
        JOIN tenant_email_accounts tea ON te.account_id = tea.id
        WHERE te.tenant_id = $1
      `;
      const params: unknown[] = [tenantId];
      let paramIndex = 2;

      if (query.accountId) {
        sql += ` AND te.account_id = $${paramIndex++}`;
        params.push(query.accountId);
      }

      if (query.unreadOnly) {
        sql += ` AND te.is_unread = true`;
      }

      if (query.minPriority !== undefined) {
        sql += ` AND te.priority_score >= $${paramIndex++}`;
        params.push(query.minPriority);
      }

      if (query.search) {
        sql += ` AND (te.subject ILIKE $${paramIndex} OR te.from_email ILIKE $${paramIndex} OR te.snippet ILIKE $${paramIndex})`;
        params.push(`%${query.search}%`);
        paramIndex++;
      }

      sql += ` ORDER BY te.priority_score DESC NULLS LAST, te.received_at DESC`;
      sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(query.limit, query.offset);

      const result = await pool.query(sql, params);

      // Get total count
      let countSql = `
        SELECT COUNT(*) FROM tracked_emails te
        WHERE te.tenant_id = $1
      `;
      const countParams: unknown[] = [tenantId];
      
      if (query.accountId) {
        countSql += ` AND te.account_id = $2`;
        countParams.push(query.accountId);
      }

      const countResult = await pool.query(countSql, countParams);

      res.json({
        emails: result.rows.map(row => ({
          id: row.id,
          accountId: row.account_id,
          accountEmail: row.account_email,
          threadId: row.thread_id,
          from: {
            email: row.from_email,
            name: row.from_name
          },
          subject: row.subject,
          snippet: row.snippet,
          isUnread: row.is_unread,
          isImportant: row.is_important,
          isStarred: row.is_starred,
          priorityScore: row.priority_score ? parseFloat(row.priority_score) : null,
          priorityRecommendation: row.priority_recommendation,
          hasDraft: row.has_draft,
          receivedAt: row.received_at
        })),
        total: parseInt(countResult.rows[0].count, 10),
        limit: query.limit,
        offset: query.offset
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid query', details: error.errors });
      }
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/email/inbox/:accountId/:emailId - Get single email details
  // -------------------------------------------------------------------------
  router.get('/inbox/:accountId/:emailId', async (req, res, next) => {
    try {
      const tenantId = req.tenant!.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant not authenticated' });
      }

      const { accountId, emailId } = req.params;

      const result = await pool.query(
        `SELECT te.*, tea.email as account_email,
                ed.id as draft_id, ed.body_text as draft_body, ed.tone as draft_tone,
                ed.status as draft_status, ed.created_at as draft_created_at
         FROM tracked_emails te
         JOIN tenant_email_accounts tea ON te.account_id = tea.id
         LEFT JOIN email_drafts ed ON te.draft_id = ed.id
         WHERE te.id = $1 AND te.account_id = $2 AND te.tenant_id = $3`,
        [emailId, accountId, tenantId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Email not found' });
      }

      const row = result.rows[0];

      res.json({
        id: row.id,
        accountId: row.account_id,
        accountEmail: row.account_email,
        threadId: row.thread_id,
        from: {
          email: row.from_email,
          name: row.from_name
        },
        to: row.to_addresses,
        cc: row.cc_addresses,
        subject: row.subject,
        snippet: row.snippet,
        bodyText: row.body_text,
        bodyHtml: row.body_html,
        isUnread: row.is_unread,
        isImportant: row.is_important,
        isStarred: row.is_starred,
        labels: row.labels,
        priorityScore: row.priority_score ? parseFloat(row.priority_score) : null,
        priorityFactors: row.priority_factors,
        priorityRecommendation: row.priority_recommendation,
        receivedAt: row.received_at,
        processedAt: row.processed_at,
        draft: row.draft_id ? {
          id: row.draft_id,
          body: row.draft_body,
          tone: row.draft_tone,
          status: row.draft_status,
          createdAt: row.draft_created_at
        } : null
      });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/email/inbox/:accountId/:emailId/draft - Generate AI draft
  // -------------------------------------------------------------------------
  router.post('/inbox/:accountId/:emailId/draft', async (req, res, next) => {
    try {
      const tenantId = req.tenant!.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant not authenticated' });
      }

      const { accountId, emailId } = req.params;
      const body = generateDraftSchema.parse(req.body);

      // Get email details
      const emailResult = await pool.query(
        `SELECT te.*, tea.email as account_email
         FROM tracked_emails te
         JOIN tenant_email_accounts tea ON te.account_id = tea.id
         WHERE te.id = $1 AND te.account_id = $2 AND te.tenant_id = $3`,
        [emailId, accountId, tenantId]
      );

      if (emailResult.rows.length === 0) {
        return res.status(404).json({ error: 'Email not found' });
      }

      const emailRow = emailResult.rows[0];

      // Get tenant info for context
      const tenantResult = await pool.query(
        'SELECT name, settings FROM tenants WHERE id = $1',
        [tenantId]
      );
      const tenant = tenantResult.rows[0];

      // Build tracked email object
      const trackedEmail = {
        id: emailRow.id,
        accountId: emailRow.account_id,
        tenantId,
        threadId: emailRow.thread_id,
        from: { email: emailRow.from_email, name: emailRow.from_name },
        to: emailRow.to_addresses || [],
        subject: emailRow.subject,
        snippet: emailRow.snippet,
        bodyText: emailRow.body_text,
        bodyHtml: emailRow.body_html,
        isUnread: emailRow.is_unread,
        isImportant: emailRow.is_important,
        isStarred: emailRow.is_starred,
        labels: emailRow.labels || [],
        priorityScore: emailRow.priority_score,
        hasDraft: emailRow.has_draft,
        receivedAt: new Date(emailRow.received_at),
        processedAt: emailRow.processed_at ? new Date(emailRow.processed_at) : null
      };

      // Generate draft
      const aiOrchestrator = getAIOrchestrator();
      const draftGenerator = new DraftGenerator(aiOrchestrator);

      const result = await draftGenerator.generateDraft({
        email: trackedEmail,
        tone: body.tone,
        context: {
          businessName: tenant?.name || 'Our Business',
          businessType: tenant?.settings?.businessType || 'hospitality',
          signatureName: tenant?.settings?.signatureName || '',
          additionalInstructions: body.additionalInstructions
        }
      });

      // Save draft to database
      const insertResult = await pool.query(
        `INSERT INTO email_drafts
         (email_id, account_id, tenant_id, subject, body_html, body_text,
          generated_by, tone, prompt_tokens, completion_tokens, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          emailId,
          accountId,
          tenantId,
          result.draft.subject,
          result.draft.bodyHtml,
          result.draft.bodyText,
          result.draft.generatedBy,
          result.draft.tone,
          result.draft.promptTokens,
          result.draft.completionTokens,
          result.confidence
        ]
      );

      // Update email to mark as having draft
      await pool.query(
        'UPDATE tracked_emails SET has_draft = true, draft_id = $1 WHERE id = $2 AND account_id = $3',
        [insertResult.rows[0].id, emailId, accountId]
      );

      // Update drafts generated count
      await pool.query(
        'UPDATE tenant_email_accounts SET drafts_generated = drafts_generated + 1 WHERE id = $1',
        [accountId]
      );

      res.json({
        draftId: insertResult.rows[0].id,
        subject: result.draft.subject,
        body: result.draft.bodyText,
        bodyHtml: result.draft.bodyHtml,
        tone: result.draft.tone,
        confidence: result.confidence,
        suggestedEdits: result.suggestedEdits
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      logger.error('Failed to generate draft', { error });
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/email/inbox/:accountId/:emailId/draft/regenerate - Regenerate with feedback
  // -------------------------------------------------------------------------
  router.post('/inbox/:accountId/:emailId/draft/regenerate', async (req, res, next) => {
    try {
      const tenantId = req.tenant!.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant not authenticated' });
      }

      const { accountId, emailId } = req.params;
      const body = regenerateDraftSchema.parse(req.body);

      // Get email and existing draft
      const emailResult = await pool.query(
        `SELECT te.*, tea.email as account_email
         FROM tracked_emails te
         JOIN tenant_email_accounts tea ON te.account_id = tea.id
         WHERE te.id = $1 AND te.account_id = $2 AND te.tenant_id = $3`,
        [emailId, accountId, tenantId]
      );

      if (emailResult.rows.length === 0) {
        return res.status(404).json({ error: 'Email not found' });
      }

      const emailRow = emailResult.rows[0];

      // Get tenant info
      const tenantResult = await pool.query(
        'SELECT name, settings FROM tenants WHERE id = $1',
        [tenantId]
      );
      const tenant = tenantResult.rows[0];

      const trackedEmail = {
        id: emailRow.id,
        accountId: emailRow.account_id,
        tenantId,
        threadId: emailRow.thread_id,
        from: { email: emailRow.from_email, name: emailRow.from_name },
        to: emailRow.to_addresses || [],
        subject: emailRow.subject,
        snippet: emailRow.snippet,
        bodyText: emailRow.body_text,
        bodyHtml: emailRow.body_html,
        isUnread: emailRow.is_unread,
        isImportant: emailRow.is_important,
        isStarred: emailRow.is_starred,
        labels: emailRow.labels || [],
        priorityScore: emailRow.priority_score,
        hasDraft: emailRow.has_draft,
        receivedAt: new Date(emailRow.received_at),
        processedAt: emailRow.processed_at ? new Date(emailRow.processed_at) : null
      };

      // Regenerate with feedback
      const aiOrchestrator = getAIOrchestrator();
      const draftGenerator = new DraftGenerator(aiOrchestrator);

      const result = await draftGenerator.regenerateDraft(
        {
          email: trackedEmail,
          tone: 'professional',
          context: {
            businessName: tenant?.name || 'Our Business',
            businessType: tenant?.settings?.businessType || 'hospitality',
            signatureName: tenant?.settings?.signatureName || ''
          }
        },
        body.previousDraft,
        body.feedback
      );

      // Mark old draft as discarded
      if (emailRow.draft_id) {
        await pool.query(
          "UPDATE email_drafts SET status = 'discarded' WHERE id = $1",
          [emailRow.draft_id]
        );
      }

      // Save new draft
      const insertResult = await pool.query(
        `INSERT INTO email_drafts
         (email_id, account_id, tenant_id, subject, body_html, body_text,
          generated_by, tone, prompt_tokens, completion_tokens, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          emailId,
          accountId,
          tenantId,
          result.draft.subject,
          result.draft.bodyHtml,
          result.draft.bodyText,
          result.draft.generatedBy,
          result.draft.tone,
          result.draft.promptTokens,
          result.draft.completionTokens,
          result.confidence
        ]
      );

      // Update email draft reference
      await pool.query(
        'UPDATE tracked_emails SET draft_id = $1 WHERE id = $2 AND account_id = $3',
        [insertResult.rows[0].id, emailId, accountId]
      );

      res.json({
        draftId: insertResult.rows[0].id,
        subject: result.draft.subject,
        body: result.draft.bodyText,
        bodyHtml: result.draft.bodyHtml,
        confidence: result.confidence,
        suggestedEdits: result.suggestedEdits
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/email/sync/:accountId - Trigger email sync
  // -------------------------------------------------------------------------
  router.post('/sync/:accountId', async (req, res, next) => {
    try {
      const tenantId = req.tenant!.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant not authenticated' });
      }

      const { accountId } = req.params;

      // Get account credentials
      const accountResult = await pool.query(
        `SELECT id, email, access_token_encrypted, refresh_token_encrypted, token_expiry
         FROM tenant_email_accounts
         WHERE id = $1 AND tenant_id = $2 AND enabled = true`,
        [accountId, tenantId]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({ error: 'Account not found or disabled' });
      }

      const account = accountResult.rows[0];

      // Create Gmail client
      const gmailClient = new GmailClient(
        accountId,
        tenantId,
        {
          access_token: account.access_token_encrypted, // TODO: Decrypt
          refresh_token: account.refresh_token_encrypted,
          expiry_date: new Date(account.token_expiry).getTime()
        },
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET
      );

      // Sync inbox
      const syncResult = await gmailClient.syncInbox({
        accountId,
        maxResults: 50,
        query: 'in:inbox'
      });

      // Score emails
      const scorer = new PriorityScorer({ useAI: false }); // Rule-based for speed

      let newCount = 0;
      let updatedCount = 0;

      for (const email of syncResult.emails) {
        const scoreResult = scorer.scoreEmail(email);

        // Upsert email
        const upsertResult = await pool.query(
          `INSERT INTO tracked_emails
           (id, account_id, tenant_id, thread_id, from_email, from_name,
            to_addresses, cc_addresses, subject, snippet, body_text, body_html,
            is_unread, is_important, is_starred, labels,
            priority_score, priority_factors, priority_recommendation,
            received_at, processed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
           ON CONFLICT (id, account_id) DO UPDATE SET
             is_unread = EXCLUDED.is_unread,
             is_important = EXCLUDED.is_important,
             is_starred = EXCLUDED.is_starred,
             labels = EXCLUDED.labels,
             priority_score = EXCLUDED.priority_score,
             priority_factors = EXCLUDED.priority_factors,
             priority_recommendation = EXCLUDED.priority_recommendation,
             updated_at = NOW()
           RETURNING (xmax = 0) as is_new`,
          [
            email.id,
            accountId,
            tenantId,
            email.threadId,
            email.from.email,
            email.from.name,
            JSON.stringify(email.to),
            JSON.stringify(email.cc || []),
            email.subject,
            email.snippet,
            email.bodyText,
            email.bodyHtml,
            email.isUnread,
            email.isImportant,
            email.isStarred,
            JSON.stringify(email.labels),
            scoreResult.score,
            JSON.stringify(scoreResult.factors),
            scoreResult.recommendation,
            email.receivedAt
          ]
        );

        if (upsertResult.rows[0].is_new) {
          newCount++;
        } else {
          updatedCount++;
        }
      }

      // Update account sync status
      await pool.query(
        `UPDATE tenant_email_accounts
         SET last_sync_at = NOW(),
             last_sync_status = 'success',
             emails_synced = emails_synced + $1
         WHERE id = $2`,
        [newCount, accountId]
      );

      // Update credentials if refreshed
      const newCreds = gmailClient.getCredentials();
      if (newCreds.expiry_date !== new Date(account.token_expiry).getTime()) {
        await pool.query(
          `UPDATE tenant_email_accounts
           SET access_token_encrypted = $1, token_expiry = $2
           WHERE id = $3`,
          [newCreds.access_token, new Date(newCreds.expiry_date || Date.now()), accountId]
        );
      }

      res.json({
        success: true,
        synced: syncResult.emails.length,
        new: newCount,
        updated: updatedCount,
        errors: syncResult.errors.length
      });
    } catch (error) {
      // Update account with error status
      const { accountId } = req.params;
      await pool.query(
        `UPDATE tenant_email_accounts
         SET last_sync_status = 'error',
             last_sync_error = $1
         WHERE id = $2`,
        [error instanceof Error ? error.message : 'Unknown error', accountId]
      ).catch(() => {});

      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/email/stats - Email statistics
  // -------------------------------------------------------------------------
  router.get('/stats', async (req, res, next) => {
    try {
      const tenantId = req.tenant!.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant not authenticated' });
      }

      const result = await pool.query(
        'SELECT * FROM get_email_sync_stats($1)',
        [tenantId]
      );

      const stats = result.rows[0] || {
        total_accounts: 0,
        enabled_accounts: 0,
        total_emails_synced: 0,
        total_drafts_generated: 0,
        last_sync: null,
        emails_today: 0,
        high_priority_unread: 0
      };

      res.json({
        accounts: {
          total: stats.total_accounts,
          enabled: stats.enabled_accounts
        },
        emails: {
          totalSynced: parseInt(stats.total_emails_synced, 10),
          today: stats.emails_today,
          highPriorityUnread: stats.high_priority_unread
        },
        drafts: {
          generated: parseInt(stats.total_drafts_generated, 10)
        },
        lastSync: stats.last_sync
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
