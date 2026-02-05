/**
 * Optimized Prompt Templates
 * 
 * Designed to minimize tokens while maximizing quality.
 * Each template is task-specific and battle-tested.
 */

export interface PromptTemplate {
  system: string;
  formatInput: (input: Record<string, any>) => string;
}

// ============================================================================
// PROMPT TEMPLATES - Optimized for token efficiency
// ============================================================================

export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  
  // --------------------------------------------------------------------------
  // SENTIMENT ANALYSIS - Ultra minimal
  // --------------------------------------------------------------------------
  sentiment: {
    system: 'Classify sentiment. Reply ONLY: positive, neutral, or negative.',
    formatInput: ({ text }) => text,
  },
  
  // --------------------------------------------------------------------------
  // MENU DESCRIPTION - Creative but concise
  // --------------------------------------------------------------------------
  menu_description: {
    system: `Write appetizing menu descriptions. Style: elegant, sensory, concise.
Rules:
- 1-2 sentences max
- Highlight key ingredients
- Mention cooking method if notable
- Include dietary info if provided`,
    formatInput: ({ 
      name, 
      ingredients = [], 
      dietaryInfo = [],
      style = 'elegant' 
    }) => {
      let prompt = `Dish: ${name}`;
      if (ingredients.length) prompt += `\nIngredients: ${ingredients.join(', ')}`;
      if (dietaryInfo.length) prompt += `\nDietary: ${dietaryInfo.join(', ')}`;
      if (style !== 'elegant') prompt += `\nStyle: ${style}`;
      return prompt;
    },
  },
  
  // --------------------------------------------------------------------------
  // REVIEW RESPONSE - Professional and warm
  // --------------------------------------------------------------------------
  review_response: {
    system: `Write review responses for a restaurant. Be warm, professional, concise.
Rules:
- Thank the customer
- Address specific points they mentioned
- If negative: apologize sincerely, offer to make it right
- If positive: express genuine gratitude
- 2-3 sentences max
- Sign off warmly`,
    formatInput: ({ 
      reviewText, 
      rating, 
      customerName,
      businessName = 'our restaurant'
    }) => {
      const sentiment = rating >= 4 ? 'positive' : rating <= 2 ? 'negative' : 'mixed';
      let prompt = `Review (${sentiment}, ${rating}★): "${reviewText}"`;
      if (customerName) prompt += `\nCustomer: ${customerName}`;
      prompt += `\nBusiness: ${businessName}`;
      return prompt;
    },
  },
  
  // --------------------------------------------------------------------------
  // TRANSLATION - Accurate and context-aware
  // --------------------------------------------------------------------------
  translation: {
    system: `Translate accurately. Preserve tone and meaning. Output translation only.`,
    formatInput: ({ 
      text, 
      targetLanguage, 
      context = 'hospitality' 
    }) => {
      return `[${context}] Translate to ${targetLanguage}:\n${text}`;
    },
  },
  
  // --------------------------------------------------------------------------
  // SUMMARY - Condensed and actionable
  // --------------------------------------------------------------------------
  summary: {
    system: `Summarize concisely. Focus on key points and actionable insights.
Format: bullet points, max 5 items.`,
    formatInput: ({ text, maxPoints = 5 }) => {
      return `Summarize in max ${maxPoints} points:\n${text}`;
    },
  },
  
  // --------------------------------------------------------------------------
  // CONTENT GENERATION - Marketing-focused
  // --------------------------------------------------------------------------
  content: {
    system: `Generate engaging marketing content for hospitality businesses.
Adapt tone to platform. Be authentic, not salesy.`,
    formatInput: ({ 
      type, // social_post, email, promo
      topic,
      platform = 'general',
      tone = 'friendly',
      maxLength = 280
    }) => {
      return `Type: ${type}
Platform: ${platform}
Tone: ${tone}
Max length: ${maxLength} chars
Topic: ${topic}`;
    },
  },
  
  // --------------------------------------------------------------------------
  // CHAT - Helpful assistant
  // --------------------------------------------------------------------------
  chat: {
    system: `You are a helpful AI assistant for a hospitality business.
Be concise, friendly, and helpful. Answer questions about the business,
menu, reservations, and general inquiries.`,
    formatInput: ({ message, context }) => {
      if (context) return `Context: ${context}\n\nCustomer: ${message}`;
      return message;
    },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a prompt template by task type
 */
export function getPromptTemplate(taskType: string): PromptTemplate | null {
  return PROMPT_TEMPLATES[taskType] || null;
}

/**
 * Build optimized messages from template
 */
export function buildOptimizedMessages(
  taskType: string,
  input: Record<string, any>
): { role: 'system' | 'user'; content: string }[] {
  const template = getPromptTemplate(taskType);
  
  if (!template) {
    // Fallback: just use input as-is
    return [{ role: 'user', content: JSON.stringify(input) }];
  }
  
  return [
    { role: 'system', content: template.system },
    { role: 'user', content: template.formatInput(input) },
  ];
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for English
  return Math.ceil(text.length / 4);
}
