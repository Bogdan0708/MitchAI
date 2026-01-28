/**
 * EMAIL DRAFT GENERATOR
 * 
 * AI-powered draft reply generator for customer emails.
 * Uses the AI orchestrator to generate contextually appropriate replies.
 * 
 * Ported from G-mail_Automation project.
 */

import { 
  TrackedEmail, 
  EmailDraft, 
  DraftRequest, 
  DraftResult, 
  DraftContext,
  DraftTone 
} from './types';
import { GmailClient } from './gmail-client';
import { AIOrchestrator } from '../ai/orchestrator';
import { logger } from '../logger.service';

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const SYSTEM_PROMPTS: Record<DraftTone, string> = {
  professional: `You are an email assistant for a hospitality business.
Write clear, professional replies that are warm yet businesslike.
- Address all points raised in the original email
- Be helpful and solution-oriented
- Use appropriate greetings and sign-offs
- Keep responses focused and actionable
- For complaints: acknowledge, apologize, offer resolution
- For bookings: confirm details clearly
- For inquiries: provide helpful, accurate information`,

  friendly: `You are an email assistant for a hospitality business.
Write warm, friendly replies that feel personal.
- Use a conversational but professional tone
- Show genuine care for the customer
- Be enthusiastic about helping
- Add a personal touch where appropriate
- Keep it natural, not robotic`,

  formal: `You are an email assistant for a hospitality business.
Write formal, respectful replies suitable for business correspondence.
- Use proper salutations and closings
- Maintain a professional distance
- Be precise and thorough
- Avoid casual language
- Use complete sentences and proper grammar`,

  concise: `You are an email assistant for a hospitality business.
Write brief, to-the-point replies.
- Get straight to the answer
- Use short sentences
- Bullet points where helpful
- No unnecessary pleasantries
- Be clear and direct`,

  detailed: `You are an email assistant for a hospitality business.
Write thorough, comprehensive replies.
- Address every point raised
- Provide context and background where helpful
- Anticipate follow-up questions
- Include relevant details
- Be complete but not repetitive`
};

const BASE_GUIDELINES = `
Output format:
- Return only the email body text, ready to send
- Do not include subject lines, "Re:", or metadata
- Do not include "[Your Name]" or similar placeholders
- Use the signature name provided if given

Important:
- Never make up information you don't have
- If unsure about something, acknowledge it and offer to find out
- For sensitive matters (refunds, complaints), be empathetic`;

// ============================================================================
// DRAFT GENERATOR
// ============================================================================

export class DraftGenerator {
  private aiOrchestrator: AIOrchestrator;

  constructor(aiOrchestrator: AIOrchestrator) {
    this.aiOrchestrator = aiOrchestrator;
  }

  /**
   * Generate a draft reply for an email
   */
  async generateDraft(request: DraftRequest): Promise<DraftResult> {
    const { email, tone = 'professional', context, maxLength = 500 } = request;

    const systemPrompt = this.buildSystemPrompt(tone, context);
    const userPrompt = this.buildUserPrompt(email, context);

    try {
      const response = await this.aiOrchestrator.process({
        tenantId: email.tenantId,
        walletAddress: undefined, // TODO: Add credit deduction
        taskType: 'review_response', // Similar task type
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        options: {
          temperature: 0.7, // Slightly creative for natural tone
          maxTokens: maxLength * 2 // Tokens != chars, give headroom
        }
      });

      const draftBody = this.cleanDraftBody(response.content);

      const draft: EmailDraft = {
        id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        emailId: email.id,
        accountId: email.accountId,
        tenantId: email.tenantId,
        
        subject: this.generateSubject(email.subject),
        bodyHtml: this.textToHtml(draftBody),
        bodyText: draftBody,
        
        generatedBy: response.model || 'unknown',
        tone,
        promptTokens: response.usage?.promptTokens || 0,
        completionTokens: response.usage?.completionTokens || 0,
        
        status: 'generated',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Calculate confidence based on response characteristics
      const confidence = this.calculateConfidence(draftBody, email);

      // Generate suggested edits
      const suggestedEdits = this.generateSuggestedEdits(draftBody, email);

      return {
        draft,
        confidence,
        suggestedEdits
      };

    } catch (error) {
      logger.error('Failed to generate email draft', {
        emailId: email.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Build system prompt with tone and context
   */
  private buildSystemPrompt(tone: DraftTone, context?: DraftContext): string {
    let prompt = SYSTEM_PROMPTS[tone] + BASE_GUIDELINES;

    if (context) {
      prompt += `\n\nBusiness context:
- Business name: ${context.businessName}
- Type: ${context.businessType}`;

      if (context.signatureName) {
        prompt += `\n- Sign off as: ${context.signatureName}`;
        if (context.signatureTitle) {
          prompt += `, ${context.signatureTitle}`;
        }
      }

      if (context.additionalInstructions) {
        prompt += `\n\nAdditional instructions: ${context.additionalInstructions}`;
      }
    }

    return prompt;
  }

  /**
   * Build user prompt from email content
   */
  private buildUserPrompt(email: TrackedEmail, context?: DraftContext): string {
    const fromDisplay = email.from.name 
      ? `${email.from.name} <${email.from.email}>`
      : email.from.email;

    // Use body text, falling back to snippet
    const bodyContent = email.bodyText || email.snippet;
    const truncatedBody = bodyContent.slice(0, 3000); // Token limit safety

    const parts = [
      'Please draft a reply to this email:',
      '',
      `**From:** ${fromDisplay}`,
      `**Subject:** ${email.subject}`,
      '',
      '**Email content:**',
      truncatedBody
    ];

    if (context?.additionalInstructions) {
      parts.push('', '**Special instructions:**', context.additionalInstructions);
    }

    parts.push('', 'Write an appropriate reply:');

    return parts.join('\n');
  }

  /**
   * Clean up the generated draft body
   */
  private cleanDraftBody(content: string): string {
    let cleaned = content.trim();

    // Remove common AI artifacts
    cleaned = cleaned.replace(/^(Subject:|Re:).*?\n/gim, '');
    cleaned = cleaned.replace(/\[Your Name\]/gi, '');
    cleaned = cleaned.replace(/\[Your Title\]/gi, '');
    cleaned = cleaned.replace(/\[Business Name\]/gi, '');
    cleaned = cleaned.replace(/\[Date\]/gi, '');
    
    // Remove markdown artifacts
    cleaned = cleaned.replace(/^\*\*.*?\*\*:?\s*/gm, '');
    
    // Remove empty lines at start/end
    cleaned = cleaned.replace(/^\s*\n+/, '');
    cleaned = cleaned.replace(/\n+\s*$/, '');

    return cleaned;
  }

  /**
   * Generate reply subject line
   */
  private generateSubject(originalSubject: string): string {
    if (originalSubject.toLowerCase().startsWith('re:')) {
      return originalSubject;
    }
    return `Re: ${originalSubject}`;
  }

  /**
   * Convert plain text to HTML
   */
  private textToHtml(text: string): string {
    return text
      .split('\n\n')
      .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('\n');
  }

  /**
   * Calculate confidence score for the draft
   */
  private calculateConfidence(draft: string, email: TrackedEmail): number {
    let confidence = 0.7; // Base confidence

    // Higher confidence for shorter, focused responses
    if (draft.length > 100 && draft.length < 500) {
      confidence += 0.1;
    }

    // Check if draft addresses the subject
    const subjectWords = email.subject.toLowerCase().split(/\s+/);
    const draftLower = draft.toLowerCase();
    const addressedSubject = subjectWords.some(word => 
      word.length > 3 && draftLower.includes(word)
    );
    if (addressedSubject) {
      confidence += 0.1;
    }

    // Check for proper greeting
    if (/^(hi|hello|dear|good morning|good afternoon)/i.test(draft)) {
      confidence += 0.05;
    }

    // Check for sign-off
    if (/(regards|sincerely|thanks|best|cheers|kind regards)/i.test(draft)) {
      confidence += 0.05;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Generate suggested edits for human review
   */
  private generateSuggestedEdits(draft: string, email: TrackedEmail): string[] {
    const suggestions: string[] = [];

    // Check for personalization
    if (!email.from.name && !/dear\s+(sir|madam|guest|customer)/i.test(draft)) {
      suggestions.push('Consider adding a personalized greeting if you know the recipient\'s name');
    }

    // Check for specific details
    if (email.subject.toLowerCase().includes('booking') || 
        email.subject.toLowerCase().includes('reservation')) {
      suggestions.push('Verify booking details (date, time, party size) are correct');
    }

    // Check for pricing mentions
    if (/\$|£|€|\d+\.\d{2}/.test(draft)) {
      suggestions.push('Double-check any prices or amounts mentioned');
    }

    // Check for date mentions
    if (/\d{1,2}\/\d{1,2}|\d{1,2}(st|nd|rd|th)\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i.test(draft)) {
      suggestions.push('Verify any dates mentioned are correct');
    }

    return suggestions;
  }

  /**
   * Regenerate draft with user feedback
   */
  async regenerateDraft(
    request: DraftRequest,
    previousDraft: string,
    feedback: string
  ): Promise<DraftResult> {
    const enhancedContext: DraftContext = {
      ...request.context,
      businessName: request.context?.businessName || '',
      businessType: request.context?.businessType || '',
      signatureName: request.context?.signatureName || '',
      additionalInstructions: `
Previous draft: "${previousDraft.slice(0, 500)}"

User feedback: ${feedback}

Please generate an improved version addressing the feedback.`
    };

    return this.generateDraft({
      ...request,
      context: enhancedContext
    });
  }

  /**
   * Generate drafts for multiple emails
   */
  async generateDraftBatch(
    emails: TrackedEmail[],
    options: {
      tone?: DraftTone;
      context?: DraftContext;
      maxConcurrent?: number;
    } = {}
  ): Promise<Map<string, DraftResult>> {
    const { tone = 'professional', context, maxConcurrent = 3 } = options;
    const results = new Map<string, DraftResult>();

    // Process in batches
    for (let i = 0; i < emails.length; i += maxConcurrent) {
      const batch = emails.slice(i, i + maxConcurrent);
      
      const batchResults = await Promise.all(
        batch.map(email => 
          this.generateDraft({ email, tone, context })
            .catch(error => {
              logger.warn(`Failed to generate draft for ${email.id}`, { error });
              return null;
            })
        )
      );

      batch.forEach((email, idx) => {
        const result = batchResults[idx];
        if (result) {
          results.set(email.id, result);
        }
      });
    }

    return results;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

let generatorInstance: DraftGenerator | null = null;

export function getDraftGenerator(
  aiOrchestrator?: AIOrchestrator
): DraftGenerator {
  if (!generatorInstance && aiOrchestrator) {
    generatorInstance = new DraftGenerator(aiOrchestrator);
  }
  if (!generatorInstance) {
    throw new Error('DraftGenerator not initialized - provide AIOrchestrator');
  }
  return generatorInstance;
}
