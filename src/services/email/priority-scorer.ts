/**
 * EMAIL PRIORITY SCORER
 * 
 * AI-powered email priority scoring using a combination of:
 * - Rule-based scoring (keywords, sender, flags)
 * - AI-assisted analysis (optional, uses AI orchestrator)
 * 
 * Ported from G-mail_Automation project.
 */

import { 
  TrackedEmail, 
  ScoringContext, 
  ScoringResult, 
  PriorityFactors 
} from './types';
import { AIOrchestrator } from '../ai/orchestrator';
import { logger } from '../logger.service';

// ============================================================================
// SCORING CONSTANTS
// ============================================================================

// Keywords that indicate high priority
const FINANCE_KEYWORDS = [
  'invoice', 'payment', 'due', 'overdue', 'balance', 'account',
  'tax', 'hmrc', 'vat', 'expense', 'refund', 'charge', 'billing',
  'receipt', 'transaction', 'bank', 'wire', 'transfer'
];

const LEGAL_KEYWORDS = [
  'contract', 'agreement', 'legal', 'lawsuit', 'court', 'notice',
  'compliance', 'regulation', 'deadline', 'terms', 'policy', 'gdpr'
];

const URGENT_KEYWORDS = [
  'urgent', 'asap', 'immediately', 'critical', 'emergency',
  'time-sensitive', 'deadline', 'today', 'now', 'important',
  'action required', 'response needed', 'please respond'
];

// Hospitality-specific keywords
const HOSPITALITY_KEYWORDS = [
  'reservation', 'booking', 'cancellation', 'guest', 'check-in',
  'check-out', 'complaint', 'refund request', 'review', 'feedback',
  'allergy', 'dietary', 'special request', 'vip', 'corporate'
];

// Sender reputation scores (domain -> base score)
const HIGH_PRIORITY_DOMAINS: Record<string, number> = {
  // Government
  'hmrc.gov.uk': 0.9,
  'gov.uk': 0.85,
  
  // Finance
  'stripe.com': 0.8,
  'paypal.com': 0.8,
  'barclays.co.uk': 0.85,
  'hsbc.com': 0.85,
  'natwest.com': 0.85,
  'lloydsbank.com': 0.85,
  
  // Booking platforms
  'booking.com': 0.75,
  'tripadvisor.com': 0.7,
  'opentable.com': 0.75,
  'resdiary.com': 0.75,
  'deliveroo.com': 0.7,
  'ubereats.com': 0.7,
  'justeat.com': 0.7,
  
  // Professional
  'linkedin.com': 0.5,
  'github.com': 0.6,
};

// Low priority patterns
const LOW_PRIORITY_PATTERNS = [
  'noreply@', 'no-reply@', 'newsletter@', 'marketing@',
  'promo@', 'deals@', 'notifications@', 'updates@',
  'digest@', 'info@', 'mailer@', 'bulk@'
];

// ============================================================================
// PRIORITY SCORER
// ============================================================================

export class PriorityScorer {
  private aiOrchestrator?: AIOrchestrator;
  private useAI: boolean;

  constructor(options: {
    aiOrchestrator?: AIOrchestrator;
    useAI?: boolean;
  } = {}) {
    this.aiOrchestrator = options.aiOrchestrator;
    this.useAI = options.useAI ?? false;
  }

  /**
   * Score an email's priority
   * 
   * Scoring factors (weighted average):
   * - Importance flag: 30%
   * - Sender reputation: 25%
   * - Keyword analysis: 25%
   * - Recency: 20%
   */
  scoreEmail(email: TrackedEmail, context?: ScoringContext): ScoringResult {
    const factors = this.calculateFactors(email, context);
    
    // Weighted average
    const weights = {
      importance: 0.30,
      senderScore: 0.25,
      keywordScore: 0.25,
      recencyScore: 0.20
    };

    const score = 
      factors.importance * weights.importance +
      factors.senderScore * weights.senderScore +
      factors.keywordScore * weights.keywordScore +
      factors.recencyScore * weights.recencyScore +
      factors.categoryBonus * 0.1; // Small bonus for category match

    const finalScore = Math.min(1.0, Math.max(0.0, score));

    return {
      score: finalScore,
      factors,
      recommendation: this.categorize(finalScore)
    };
  }

  /**
   * Calculate individual scoring factors
   */
  private calculateFactors(
    email: TrackedEmail, 
    context?: ScoringContext
  ): PriorityFactors {
    return {
      importance: this.scoreImportance(email),
      senderScore: this.scoreSender(email, context),
      keywordScore: this.scoreKeywords(email),
      recencyScore: this.scoreRecency(email),
      categoryBonus: this.scoreCategoryBonus(email, context)
    };
  }

  /**
   * Score based on Gmail importance flags
   */
  private scoreImportance(email: TrackedEmail): number {
    let score = 0.0;

    if (email.isImportant) {
      score += 0.8;
    }
    if (email.isStarred) {
      score += 0.5;
    }
    if (email.labels.includes('CATEGORY_PRIMARY')) {
      score += 0.2;
    }

    return Math.min(1.0, score);
  }

  /**
   * Score based on sender reputation
   */
  private scoreSender(email: TrackedEmail, context?: ScoringContext): number {
    const fromEmail = email.from.email.toLowerCase();
    
    // Check if known sender from context
    if (context?.knownSenders?.some(s => fromEmail.includes(s.toLowerCase()))) {
      return 0.85;
    }

    // Extract domain
    const domainMatch = fromEmail.match(/@([\w.-]+)/);
    if (!domainMatch) {
      return 0.3; // Unknown sender format
    }

    const domain = domainMatch[1];

    // Check important domains from context
    if (context?.importantDomains?.some(d => domain.endsWith(d))) {
      return 0.85;
    }

    // Check high-priority domains
    for (const [knownDomain, score] of Object.entries(HIGH_PRIORITY_DOMAINS)) {
      if (domain.endsWith(knownDomain)) {
        return score;
      }
    }

    // Check low-priority patterns
    for (const pattern of LOW_PRIORITY_PATTERNS) {
      if (fromEmail.includes(pattern)) {
        return 0.15;
      }
    }

    return 0.5; // Default
  }

  /**
   * Score based on keyword presence
   */
  private scoreKeywords(email: TrackedEmail): number {
    const subject = email.subject.toLowerCase();
    const snippet = email.snippet.toLowerCase();
    const text = `${subject} ${snippet}`;
    
    let score = 0.0;

    // Urgent keywords (highest weight)
    if (URGENT_KEYWORDS.some(kw => text.includes(kw))) {
      score += 0.35;
    }

    // Finance keywords
    if (FINANCE_KEYWORDS.some(kw => text.includes(kw))) {
      score += 0.25;
    }

    // Legal keywords
    if (LEGAL_KEYWORDS.some(kw => text.includes(kw))) {
      score += 0.25;
    }

    // Hospitality keywords
    if (HOSPITALITY_KEYWORDS.some(kw => text.includes(kw))) {
      score += 0.2;
    }

    return Math.min(1.0, score);
  }

  /**
   * Score based on email age (newer = higher)
   */
  private scoreRecency(email: TrackedEmail): number {
    const now = new Date();
    const received = new Date(email.receivedAt);
    const ageHours = (now.getTime() - received.getTime()) / (1000 * 60 * 60);

    // Scoring curve
    if (ageHours < 1) return 1.0;
    if (ageHours < 4) return 0.9;
    if (ageHours < 24) return 0.7;
    if (ageHours < 48) return 0.5;
    if (ageHours < 168) return 0.3; // 1 week
    return 0.1;
  }

  /**
   * Bonus score based on business category match
   */
  private scoreCategoryBonus(
    email: TrackedEmail, 
    context?: ScoringContext
  ): number {
    if (!context?.businessType) return 0;

    const text = `${email.subject} ${email.snippet}`.toLowerCase();

    // Hospitality-specific bonuses
    if (context.businessType === 'restaurant' || context.businessType === 'hotel') {
      if (text.includes('reservation') || text.includes('booking')) {
        return 0.3;
      }
      if (text.includes('review') || text.includes('feedback')) {
        return 0.25;
      }
      if (text.includes('complaint') || text.includes('refund')) {
        return 0.35;
      }
    }

    return 0;
  }

  /**
   * Categorize priority score
   */
  private categorize(score: number): 'urgent' | 'important' | 'normal' | 'low' {
    if (score >= 0.75) return 'urgent';
    if (score >= 0.5) return 'important';
    if (score >= 0.25) return 'normal';
    return 'low';
  }

  /**
   * Score email using AI for enhanced analysis
   */
  async scoreEmailWithAI(
    email: TrackedEmail,
    context?: ScoringContext
  ): Promise<ScoringResult> {
    // Get base score first
    const baseResult = this.scoreEmail(email, context);

    if (!this.useAI || !this.aiOrchestrator) {
      return baseResult;
    }

    try {
      const bodyPreview = (email.bodyText || email.snippet).slice(0, 500);

      const prompt = `Analyze this email and assess its priority for a hospitality business.

Subject: ${email.subject}
From: ${email.from.email}${email.from.name ? ` (${email.from.name})` : ''}
Content preview: ${bodyPreview}

Consider:
- Urgency of response needed
- Financial/legal implications
- Customer relationship importance
- Time sensitivity
- Business impact

Respond with JSON only:
{"priority": 0.0-1.0, "reason": "brief explanation", "category": "booking|finance|complaint|review|inquiry|marketing|other", "suggestedAction": "reply_urgent|reply_soon|reply_when_free|no_action_needed"}`;

      const response = await this.aiOrchestrator.process({
        tenantId: context?.tenantId || 'system',
        taskType: 'sentiment', // Uses lighter model
        messages: [
          { role: 'system', content: 'You are an email triage assistant for hospitality businesses. Analyze emails and assess their priority. Respond only with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        options: {
          temperature: 0.3,
          maxTokens: 200
        }
      });

      // Parse AI response
      let aiAnalysis: { priority?: number; reason?: string; category?: string };
      try {
        aiAnalysis = JSON.parse(response.content);
      } catch {
        // If JSON parsing fails, extract priority from text
        const priorityMatch = response.content.match(/priority["\s:]+(\d\.?\d*)/i);
        aiAnalysis = {
          priority: priorityMatch ? parseFloat(priorityMatch[1]) : 0.5
        };
      }

      const aiScore = aiAnalysis.priority ?? 0.5;
      
      // Blend AI and rule-based scores (60% AI, 40% rules)
      const finalScore = (baseResult.score * 0.4) + (aiScore * 0.6);

      return {
        score: Math.min(1.0, Math.max(0.0, finalScore)),
        factors: baseResult.factors,
        recommendation: this.categorize(finalScore),
        reasoning: aiAnalysis.reason
      };

    } catch (error) {
      logger.warn('AI scoring failed, using rule-based score', { 
        emailId: email.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return baseResult;
    }
  }

  /**
   * Score batch of emails
   */
  async scoreEmailBatch(
    emails: TrackedEmail[],
    context?: ScoringContext
  ): Promise<Map<string, ScoringResult>> {
    const results = new Map<string, ScoringResult>();

    for (const email of emails) {
      const result = this.useAI 
        ? await this.scoreEmailWithAI(email, context)
        : this.scoreEmail(email, context);
      
      results.set(email.id, result);
    }

    return results;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

let scorerInstance: PriorityScorer | null = null;

export function getPriorityScorer(options?: {
  aiOrchestrator?: AIOrchestrator;
  useAI?: boolean;
}): PriorityScorer {
  if (!scorerInstance) {
    scorerInstance = new PriorityScorer(options);
  }
  return scorerInstance;
}
