/**
 * AI Credit Configuration
 * 
 * Each AI action costs a certain number of credits.
 * Tenants get included credits based on their tier.
 * Overage is charged per credit above the limit.
 */

// Credits per AI action
export const CREDIT_COSTS: Record<string, number> = {
  chat: 1,
  review_response: 2,
  menu_description: 1,
  menu_ai: 1,
  sentiment: 1,
  content: 5,
  translation: 1,
  summary: 2,
  code: 3,
};

// Included credits per tier (monthly)
export const TIER_CREDITS: Record<string, number> = {
  starter: 500,
  professional: 2000,
  enterprise: 10000,
  trial: 100,
};

// Overage rate per credit (in GBP)
export const OVERAGE_RATES: Record<string, number> = {
  starter: 0.02,
  professional: 0.015,
  enterprise: 0.01,
  trial: 0.03, // Higher rate to encourage upgrade
};

// Get credit cost for a task type
export function getCreditCost(taskType: string): number {
  return CREDIT_COSTS[taskType] || 1;
}

// Get included credits for a tier
export function getTierCredits(tier: string): number {
  return TIER_CREDITS[tier.toLowerCase()] || TIER_CREDITS.starter;
}

// Get overage rate for a tier
export function getOverageRate(tier: string): number {
  return OVERAGE_RATES[tier.toLowerCase()] || OVERAGE_RATES.starter;
}

// Calculate overage charges
export function calculateOverage(
  creditsUsed: number,
  tier: string
): { overage: number; charge: number } {
  const included = getTierCredits(tier);
  const rate = getOverageRate(tier);
  
  if (creditsUsed <= included) {
    return { overage: 0, charge: 0 };
  }
  
  const overage = creditsUsed - included;
  const charge = overage * rate;
  
  return { overage, charge };
}
