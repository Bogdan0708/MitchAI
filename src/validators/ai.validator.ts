/**
 * AI ENDPOINT VALIDATORS
 *
 * Zod schemas for AI-related API endpoints
 */

import { z } from 'zod';

// Chat endpoint validation
export const chatMessageSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid().optional(),
    message: z.string().min(1).max(2000),
    channel: z.enum(['web', 'whatsapp', 'voice', 'sms']).optional().default('web'),
    customerName: z.string().max(100).optional(),
    customerEmail: z.string().email().optional(),
    customerPhone: z.string().max(20).optional(),
    language: z.string().max(10).optional().default('en'),
    locationId: z.string().uuid().optional()
  })
});

// Menu AI enhance validation
export const menuEnhanceSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    style: z.enum(['casual', 'fine_dining', 'street_food', 'family']).optional(),
    generateDescription: z.boolean().optional().default(true),
    detectAllergens: z.boolean().optional().default(true),
    suggestPrice: z.boolean().optional().default(false),
    translateTo: z.array(z.string().length(2)).optional() // ISO language codes
  })
});

// Batch menu enhance validation
export const batchMenuEnhanceSchema = z.object({
  body: z.object({
    menuItemIds: z.array(z.string().uuid()).min(1).max(50),
    style: z.enum(['casual', 'fine_dining', 'street_food', 'family']).optional(),
    generateDescription: z.boolean().optional().default(true),
    detectAllergens: z.boolean().optional().default(true)
  })
});

// Recommendations endpoint validation
export const recommendationsSchema = z.object({
  query: z.object({
    locationId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    context: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'default']).optional(),
    limit: z.coerce.number().int().min(1).max(20).optional().default(5),
    includeReasons: z.coerce.boolean().optional().default(true)
  })
});

// Review AI response validation
export const reviewResponseSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    tone: z.enum(['professional', 'friendly', 'apologetic', 'thankful']).optional(),
    maxLength: z.number().int().min(50).max(500).optional().default(200),
    includeOffer: z.boolean().optional().default(false), // Include discount/compensation offer
    customInstructions: z.string().max(500).optional()
  })
});

// Review creation/import validation
export const createReviewSchema = z.object({
  body: z.object({
    locationId: z.string().uuid(),
    source: z.enum(['google', 'yelp', 'tripadvisor', 'facebook', 'internal']),
    rating: z.number().min(1).max(5),
    reviewerName: z.string().max(100).optional(),
    reviewText: z.string().max(5000),
    reviewDate: z.string().datetime().optional(),
    externalId: z.string().max(100).optional()
  })
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>['body'];
export type MenuEnhanceInput = z.infer<typeof menuEnhanceSchema>['body'];
export type RecommendationsQuery = z.infer<typeof recommendationsSchema>['query'];
export type ReviewResponseInput = z.infer<typeof reviewResponseSchema>['body'];
