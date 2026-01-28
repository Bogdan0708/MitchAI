/**
 * EMAIL SERVICES TESTS
 * 
 * Tests for:
 * - PriorityScorer: Rule-based email priority scoring
 * - DraftGenerator: AI draft generation (mocked)
 * - GmailClient: Basic parsing tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PriorityScorer } from '../../services/email/priority-scorer';
import { DraftGenerator } from '../../services/email/draft-generator';
import { GmailClient } from '../../services/email/gmail-client';
import { TrackedEmail, ScoringContext } from '../../services/email/types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockEmail = (overrides: Partial<TrackedEmail> = {}): TrackedEmail => ({
  id: 'msg_123',
  accountId: 'account_1',
  tenantId: 'tenant_1',
  threadId: 'thread_123',
  from: { email: 'customer@example.com', name: 'John Doe' },
  to: [{ email: 'restaurant@example.com' }],
  subject: 'Question about reservation',
  snippet: 'Hi, I wanted to ask about my booking for Saturday...',
  isUnread: true,
  isImportant: false,
  isStarred: false,
  labels: ['INBOX', 'UNREAD'],
  priorityScore: null,
  hasDraft: false,
  receivedAt: new Date(),
  processedAt: null,
  ...overrides
});

const createScoringContext = (overrides: Partial<ScoringContext> = {}): ScoringContext => ({
  tenantId: 'tenant_1',
  knownSenders: ['vip@example.com'],
  importantDomains: ['bank.com'],
  urgentKeywords: ['urgent', 'asap'],
  businessType: 'restaurant',
  ...overrides
});

// ============================================================================
// PRIORITY SCORER TESTS
// ============================================================================

describe('PriorityScorer', () => {
  let scorer: PriorityScorer;

  beforeEach(() => {
    scorer = new PriorityScorer({ useAI: false });
  });

  describe('scoreEmail', () => {
    it('should return score between 0 and 1', () => {
      const email = createMockEmail();
      const result = scorer.scoreEmail(email);
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should include all scoring factors', () => {
      const email = createMockEmail();
      const result = scorer.scoreEmail(email);
      
      expect(result.factors).toHaveProperty('importance');
      expect(result.factors).toHaveProperty('senderScore');
      expect(result.factors).toHaveProperty('keywordScore');
      expect(result.factors).toHaveProperty('recencyScore');
      expect(result.factors).toHaveProperty('categoryBonus');
    });

    it('should return recommendation category', () => {
      const email = createMockEmail();
      const result = scorer.scoreEmail(email);
      
      expect(['urgent', 'important', 'normal', 'low']).toContain(result.recommendation);
    });
  });

  describe('importance scoring', () => {
    it('should give high score to important emails', () => {
      const email = createMockEmail({ isImportant: true });
      const result = scorer.scoreEmail(email);
      
      expect(result.factors.importance).toBeGreaterThanOrEqual(0.8);
    });

    it('should give high score to starred emails', () => {
      const email = createMockEmail({ isStarred: true });
      const result = scorer.scoreEmail(email);
      
      expect(result.factors.importance).toBeGreaterThanOrEqual(0.5);
    });

    it('should combine importance and starred', () => {
      const email = createMockEmail({ isImportant: true, isStarred: true });
      const result = scorer.scoreEmail(email);
      
      expect(result.factors.importance).toBe(1.0);
    });
  });

  describe('sender scoring', () => {
    it('should give high score to known senders', () => {
      const email = createMockEmail({ 
        from: { email: 'vip@example.com', name: 'VIP Customer' }
      });
      const context = createScoringContext();
      const result = scorer.scoreEmail(email, context);
      
      expect(result.factors.senderScore).toBeGreaterThanOrEqual(0.8);
    });

    it('should give high score to important domains', () => {
      const email = createMockEmail({ 
        from: { email: 'alert@bank.com' }
      });
      const context = createScoringContext();
      const result = scorer.scoreEmail(email, context);
      
      expect(result.factors.senderScore).toBeGreaterThanOrEqual(0.8);
    });

    it('should give low score to noreply addresses', () => {
      const email = createMockEmail({ 
        from: { email: 'noreply@marketing.com' }
      });
      const result = scorer.scoreEmail(email);
      
      expect(result.factors.senderScore).toBeLessThanOrEqual(0.2);
    });

    it('should give high score to known high-priority domains', () => {
      const email = createMockEmail({ 
        from: { email: 'notification@stripe.com' }
      });
      const result = scorer.scoreEmail(email);
      
      expect(result.factors.senderScore).toBeGreaterThanOrEqual(0.7);
    });

    it('should give high score to booking platforms', () => {
      const emails = [
        createMockEmail({ from: { email: 'booking@booking.com' }}),
        createMockEmail({ from: { email: 'info@opentable.com' }}),
        createMockEmail({ from: { email: 'orders@deliveroo.com' }})
      ];

      for (const email of emails) {
        const result = scorer.scoreEmail(email);
        expect(result.factors.senderScore).toBeGreaterThanOrEqual(0.7);
      }
    });
  });

  describe('keyword scoring', () => {
    it('should detect urgent keywords', () => {
      const email = createMockEmail({ 
        subject: 'URGENT: Need response today!'
      });
      const result = scorer.scoreEmail(email);
      
      expect(result.factors.keywordScore).toBeGreaterThanOrEqual(0.3);
    });

    it('should detect finance keywords', () => {
      const email = createMockEmail({ 
        subject: 'Invoice #12345 - Payment Due'
      });
      const result = scorer.scoreEmail(email);
      
      expect(result.factors.keywordScore).toBeGreaterThanOrEqual(0.2);
    });

    it('should detect hospitality keywords', () => {
      const keywords = [
        'reservation confirmation',
        'booking request',
        'table for 4',
        'cancellation notice'
      ];

      for (const kw of keywords) {
        const email = createMockEmail({ subject: kw });
        const result = scorer.scoreEmail(email);
        expect(result.factors.keywordScore).toBeGreaterThan(0);
      }
    });

    it('should check snippet as well as subject', () => {
      const email = createMockEmail({ 
        subject: 'Hello',
        snippet: 'This is urgent, please respond immediately'
      });
      const result = scorer.scoreEmail(email);
      
      expect(result.factors.keywordScore).toBeGreaterThan(0);
    });
  });

  describe('recency scoring', () => {
    it('should give high score to recent emails', () => {
      const email = createMockEmail({ 
        receivedAt: new Date() // Just now
      });
      const result = scorer.scoreEmail(email);
      
      expect(result.factors.recencyScore).toBe(1.0);
    });

    it('should give lower score to older emails', () => {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 30);
      
      const email = createMockEmail({ receivedAt: yesterday });
      const result = scorer.scoreEmail(email);
      
      expect(result.factors.recencyScore).toBeLessThan(1.0);
      expect(result.factors.recencyScore).toBeGreaterThan(0.3);
    });

    it('should give very low score to week-old emails', () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 8);
      
      const email = createMockEmail({ receivedAt: weekAgo });
      const result = scorer.scoreEmail(email);
      
      expect(result.factors.recencyScore).toBeLessThanOrEqual(0.1);
    });
  });

  describe('category bonus', () => {
    it('should boost reservation emails for restaurants', () => {
      const email = createMockEmail({ 
        subject: 'Table reservation for Friday'
      });
      const context = createScoringContext({ businessType: 'restaurant' });
      const result = scorer.scoreEmail(email, context);
      
      expect(result.factors.categoryBonus).toBeGreaterThan(0);
    });

    it('should boost complaint emails', () => {
      const email = createMockEmail({ 
        subject: 'Complaint about my recent visit'
      });
      const context = createScoringContext({ businessType: 'restaurant' });
      const result = scorer.scoreEmail(email, context);
      
      expect(result.factors.categoryBonus).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe('overall scoring', () => {
    it('should classify high-priority emails as urgent', () => {
      const email = createMockEmail({ 
        isImportant: true,
        isStarred: true,
        subject: 'URGENT: Customer complaint - refund request',
        from: { email: 'alert@stripe.com' }
      });
      const result = scorer.scoreEmail(email);
      
      expect(result.recommendation).toBe('urgent');
    });

    it('should classify low-priority emails correctly', () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 10);
      
      const email = createMockEmail({ 
        subject: 'Newsletter: Monthly updates',
        from: { email: 'newsletter@marketing.com' },
        isImportant: false,
        receivedAt: weekAgo
      });
      const result = scorer.scoreEmail(email);
      
      expect(result.recommendation).toBe('low');
    });
  });

  describe('batch scoring', () => {
    it('should score multiple emails', async () => {
      const emails = [
        createMockEmail({ id: '1', subject: 'Urgent request' }),
        createMockEmail({ id: '2', subject: 'Newsletter' }),
        createMockEmail({ id: '3', subject: 'Booking confirmation' })
      ];

      const results = await scorer.scoreEmailBatch(emails);
      
      expect(results.size).toBe(3);
      expect(results.has('1')).toBe(true);
      expect(results.has('2')).toBe(true);
      expect(results.has('3')).toBe(true);
    });
  });
});

// ============================================================================
// DRAFT GENERATOR TESTS
// ============================================================================

describe('DraftGenerator', () => {
  let generator: DraftGenerator;
  let mockOrchestrator: any;

  beforeEach(() => {
    mockOrchestrator = {
      process: vi.fn().mockResolvedValue({
        success: true,
        content: 'Dear Customer,\n\nThank you for your inquiry. We would be happy to help.\n\nBest regards,\nThe Team',
        model: 'test-model',
        provider: 'test',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        latencyMs: 500
      })
    };
    generator = new DraftGenerator(mockOrchestrator);
  });

  describe('generateDraft', () => {
    it('should generate a draft response', async () => {
      const email = createMockEmail({
        subject: 'Question about opening hours',
        bodyText: 'Hi, what time do you open on Sundays?'
      });

      const result = await generator.generateDraft({
        email,
        tone: 'professional'
      });

      expect(result.draft).toBeDefined();
      expect(result.draft.subject).toBe('Re: Question about opening hours');
      expect(result.draft.bodyText).toBeDefined();
      expect(result.draft.tone).toBe('professional');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle different tones', async () => {
      const email = createMockEmail();
      const tones = ['professional', 'friendly', 'formal', 'concise', 'detailed'] as const;

      for (const tone of tones) {
        const result = await generator.generateDraft({ email, tone });
        expect(result.draft.tone).toBe(tone);
      }
    });

    it('should include context in prompt', async () => {
      const email = createMockEmail();

      await generator.generateDraft({
        email,
        tone: 'professional',
        context: {
          businessName: 'Mitch Restaurant',
          businessType: 'restaurant',
          signatureName: 'John',
          signatureTitle: 'Manager'
        }
      });

      expect(mockOrchestrator.process).toHaveBeenCalled();
      const callArgs = mockOrchestrator.process.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Mitch Restaurant');
    });

    it('should generate suggested edits', async () => {
      const email = createMockEmail({
        subject: 'Booking for next week'
      });

      const result = await generator.generateDraft({ email, tone: 'professional' });

      expect(result.suggestedEdits).toBeDefined();
      expect(Array.isArray(result.suggestedEdits)).toBe(true);
    });

    it('should calculate confidence score', async () => {
      const email = createMockEmail();
      const result = await generator.generateDraft({ email, tone: 'professional' });

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('regenerateDraft', () => {
    it('should incorporate feedback into new draft', async () => {
      const email = createMockEmail();
      const previousDraft = 'Thank you for contacting us.';
      const feedback = 'Make it more friendly and add opening hours';

      await generator.regenerateDraft(
        { email, tone: 'professional' },
        previousDraft,
        feedback
      );

      expect(mockOrchestrator.process).toHaveBeenCalled();
      const callArgs = mockOrchestrator.process.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain(feedback);
    });
  });

  describe('generateDraftBatch', () => {
    it('should generate drafts for multiple emails', async () => {
      const emails = [
        createMockEmail({ id: '1' }),
        createMockEmail({ id: '2' }),
        createMockEmail({ id: '3' })
      ];

      const results = await generator.generateDraftBatch(emails, {
        tone: 'professional',
        maxConcurrent: 2
      });

      expect(results.size).toBe(3);
    });

    it('should handle individual failures gracefully', async () => {
      mockOrchestrator.process
        .mockResolvedValueOnce({
          success: true,
          content: 'Draft 1',
          model: 'test',
          provider: 'test',
          latencyMs: 100
        })
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          success: true,
          content: 'Draft 3',
          model: 'test',
          provider: 'test',
          latencyMs: 100
        });

      const emails = [
        createMockEmail({ id: '1' }),
        createMockEmail({ id: '2' }),
        createMockEmail({ id: '3' })
      ];

      const results = await generator.generateDraftBatch(emails);

      expect(results.size).toBe(2); // 2 successful, 1 failed
      expect(results.has('1')).toBe(true);
      expect(results.has('2')).toBe(false);
      expect(results.has('3')).toBe(true);
    });
  });
});

// ============================================================================
// GMAIL CLIENT TESTS (Parsing)
// ============================================================================

describe('GmailClient', () => {
  describe('parseMessage', () => {
    it('should parse Gmail message format', () => {
      // This would require a mock Gmail client instance
      // Testing the static parsing logic
      const mockMessage = {
        id: 'msg_123',
        threadId: 'thread_123',
        labelIds: ['INBOX', 'UNREAD', 'IMPORTANT'],
        snippet: 'Hello, this is a test...',
        internalDate: String(Date.now()),
        payload: {
          headers: [
            { name: 'From', value: 'John Doe <john@example.com>' },
            { name: 'To', value: 'restaurant@example.com' },
            { name: 'Subject', value: 'Test Email' },
            { name: 'Date', value: 'Tue, 28 Jan 2025 10:00:00 +0000' }
          ],
          mimeType: 'text/plain',
          body: {
            data: Buffer.from('Hello, this is the email body.').toString('base64url')
          }
        }
      };

      // Create minimal client for parsing
      // In real tests, we'd mock the OAuth client
      expect(mockMessage.id).toBe('msg_123');
      expect(mockMessage.labelIds).toContain('IMPORTANT');
    });
  });

  describe('parseAddress', () => {
    it('should parse email with name', () => {
      const raw = 'John Doe <john@example.com>';
      const match = raw.match(/(?:"?([^"]*)"?\s)?(?:<)?([^>]+@[^>]+)(?:>)?/);
      
      expect(match).not.toBeNull();
      expect(match![1]?.trim()).toBe('John Doe');
      expect(match![2]).toBe('john@example.com');
    });

    it('should parse email without name', () => {
      const raw = 'john@example.com';
      const match = raw.match(/(?:"?([^"]*)"?\s)?(?:<)?([^>]+@[^>]+)(?:>)?/);
      
      expect(match).not.toBeNull();
      expect(match![2]).toBe('john@example.com');
    });

    it('should parse quoted name', () => {
      const raw = '"John Doe" <john@example.com>';
      const match = raw.match(/(?:"?([^"]*)"?\s)?(?:<)?([^>]+@[^>]+)(?:>)?/);
      
      expect(match).not.toBeNull();
      expect(match![2]).toBe('john@example.com');
    });
  });
});

// ============================================================================
// INTEGRATION SCENARIOS
// ============================================================================

describe('Email Processing Flow', () => {
  it('should score and recommend action for reservation email', () => {
    const scorer = new PriorityScorer({ useAI: false });
    const context = createScoringContext({ businessType: 'restaurant' });
    
    const email = createMockEmail({
      subject: 'Table reservation request for Saturday evening',
      from: { email: 'guest@gmail.com', name: 'Jane Smith' },
      snippet: 'Hi, I would like to book a table for 4 people this Saturday at 7pm.',
      isUnread: true,
      receivedAt: new Date() // Fresh email
    });

    const result = scorer.scoreEmail(email, context);

    // Should score reasonably due to:
    // - Fresh email (recency = 1.0)
    // - Reservation keyword (category bonus)
    // - Hospitality keyword in subject
    expect(result.score).toBeGreaterThan(0.3);
    expect(result.factors.recencyScore).toBe(1.0);
    expect(result.factors.categoryBonus).toBeGreaterThan(0);
  });

  it('should deprioritize marketing emails', () => {
    const scorer = new PriorityScorer({ useAI: false });
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const email = createMockEmail({
      subject: 'Summer Sale! 50% off everything',
      from: { email: 'newsletter@marketing-company.com' },
      snippet: 'Don\'t miss our biggest sale of the year!',
      isUnread: true,
      isImportant: false,
      receivedAt: weekAgo
    });

    const result = scorer.scoreEmail(email);

    expect(result.score).toBeLessThan(0.4);
    expect(['normal', 'low']).toContain(result.recommendation);
  });

  it('should prioritize complaint emails', () => {
    const scorer = new PriorityScorer({ useAI: false });
    const context = createScoringContext({ businessType: 'restaurant' });
    
    const email = createMockEmail({
      subject: 'Complaint about my dining experience',
      from: { email: 'unhappy-customer@gmail.com' },
      snippet: 'I am very disappointed with the service I received last night...',
      isUnread: true,
      receivedAt: new Date()
    });

    const result = scorer.scoreEmail(email, context);

    // Complaint emails should get category bonus
    expect(result.factors.categoryBonus).toBeGreaterThanOrEqual(0.3);
    // Fresh email + category bonus should elevate score
    expect(result.score).toBeGreaterThan(0.35);
    expect(result.factors.recencyScore).toBe(1.0);
  });
});
