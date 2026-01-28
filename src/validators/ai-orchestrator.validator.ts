/**
 * AI Orchestrator Validators
 * 
 * Request validation schemas for AI endpoints using Zod
 */

import { z } from 'zod';

// Wallet address pattern for Mitch Chain
const walletAddressSchema = z.string().regex(/^mitch1[a-z0-9]{38,}$/).optional();

// ============================================================================
// REVIEW RESPONSE
// ============================================================================

export const generateReviewResponseSchema = z.object({
  body: z.object({
    review: z.object({
      platform: z.enum(['google', 'tripadvisor', 'yelp', 'facebook', 'opentable', 'deliveroo', 'uber_eats', 'other']),
      rating: z.number().min(1).max(5),
      text: z.string().min(1).max(5000),
      customer_name: z.string().max(100).optional(),
      date: z.string().datetime().optional(),
    }),
    business_context: z.object({
      name: z.string().max(200).optional(),
      type: z.enum(['restaurant', 'hotel', 'bar', 'cafe', 'pub', 'fast_food', 'other']).optional(),
      tone: z.enum(['professional', 'friendly', 'casual']).optional(),
      language: z.string().max(20).optional(),
    }).optional(),
    wallet_address: walletAddressSchema,
    preferred_provider: z.enum(['openai', 'anthropic', 'google', 'local']).optional(),
  }),
});

// ============================================================================
// MENU DESCRIPTION
// ============================================================================

export const generateMenuDescriptionSchema = z.object({
  body: z.object({
    item: z.object({
      name: z.string().min(1).max(200),
      category: z.string().max(100).optional(),
      ingredients: z.array(z.string().max(100)).max(30).optional(),
      allergens: z.array(z.string().max(50)).max(20).optional(),
      price: z.number().min(0).max(10000).optional(),
      is_vegetarian: z.boolean().optional(),
      is_vegan: z.boolean().optional(),
      is_gluten_free: z.boolean().optional(),
    }),
    style: z.enum(['elegant', 'casual', 'fun', 'descriptive']).optional(),
    language: z.string().max(20).optional(),
    max_length: z.number().min(20).max(500).optional(),
    wallet_address: walletAddressSchema,
  }),
});

// ============================================================================
// CONTENT GENERATION
// ============================================================================

export const generateContentSchema = z.object({
  body: z.object({
    type: z.enum(['social_post', 'email', 'promo', 'announcement']),
    topic: z.string().min(3).max(500),
    context: z.string().max(2000).optional(),
    tone: z.enum(['professional', 'friendly', 'exciting', 'informative']).optional(),
    platform: z.enum(['instagram', 'facebook', 'twitter', 'email', 'whatsapp', 'other']).optional(),
    language: z.string().max(20).optional(),
    max_length: z.number().min(50).max(5000).optional(),
    wallet_address: walletAddressSchema,
  }),
});

// ============================================================================
// SENTIMENT ANALYSIS
// ============================================================================

export const analyzeSentimentSchema = z.object({
  body: z.object({
    texts: z.array(z.string().min(1).max(2000)).min(1).max(50),
    wallet_address: walletAddressSchema,
  }),
});

// ============================================================================
// TRANSLATION
// ============================================================================

export const translateSchema = z.object({
  body: z.object({
    text: z.string().min(1).max(10000),
    target_language: z.string().min(2).max(50),
    source_language: z.string().min(2).max(50).optional(),
    context: z.enum(['hospitality', 'menu', 'formal', 'casual']).optional(),
    wallet_address: walletAddressSchema,
  }),
});

// ============================================================================
// CHAT
// ============================================================================

export const chatSchema = z.object({
  body: z.object({
    messages: z.array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(10000),
      })
    ).min(1).max(50),
    business_context: z.string().max(2000).optional(),
    wallet_address: walletAddressSchema,
    preferred_provider: z.enum(['openai', 'anthropic', 'google', 'local']).optional(),
  }),
});
