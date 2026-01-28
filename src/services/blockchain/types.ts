/**
 * MTC Blockchain Types
 * Mitch Chain (Cosmos SDK) TypeScript interfaces
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export interface MTCConfig {
  rpcUrl: string;      // e.g., http://localhost:26657
  restUrl: string;     // e.g., http://localhost:1317
  chainId: string;     // e.g., mitch-1
  denom: string;       // uMTC
  gasPrice: string;    // e.g., 0.025uMTC
}

export interface TxResult {
  success: boolean;
  txHash: string;
  height: number;
  gasUsed: number;
  rawLog?: string;
  error?: string;
}

// ============================================================================
// LOYALTY MODULE TYPES
// ============================================================================

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyAccount {
  address: string;
  points: bigint;
  tier: LoyaltyTier;
  lifetimePoints: bigint;
  multiplier: number;  // Tier-based multiplier (1.0 - 2.0)
  benefits: string[];
  lastUpdated: Date;
}

export interface LoyaltyTierConfig {
  tier: LoyaltyTier;
  requiredPoints: number;
  multiplier: number;
  benefits: string[];
}

export const LOYALTY_TIERS: LoyaltyTierConfig[] = [
  { tier: 'bronze', requiredPoints: 0, multiplier: 1.0, benefits: ['basic_rewards'] },
  { tier: 'silver', requiredPoints: 1000, multiplier: 1.25, benefits: ['basic_rewards', 'priority_support'] },
  { tier: 'gold', requiredPoints: 5000, multiplier: 1.5, benefits: ['basic_rewards', 'priority_support', 'exclusive_offers'] },
  { tier: 'platinum', requiredPoints: 20000, multiplier: 2.0, benefits: ['basic_rewards', 'priority_support', 'exclusive_offers', 'vip_events'] },
];

export interface RewardRule {
  ruleId: string;
  action: LoyaltyAction;
  basePoints: number;
  description: string;
}

export type LoyaltyAction = 
  | 'purchase'           // Points per £1 spent
  | 'review'             // Submit a review
  | 'referral'           // Refer a friend
  | 'social_share'       // Share on social media
  | 'repeat_visit'       // Visit within 7 days
  | 'birthday'           // Birthday bonus
  | 'signup';            // Account creation

export const DEFAULT_REWARD_RULES: RewardRule[] = [
  { ruleId: 'purchase', action: 'purchase', basePoints: 10, description: '10 points per £1 spent' },
  { ruleId: 'review', action: 'review', basePoints: 50, description: '50 points for a review' },
  { ruleId: 'referral', action: 'referral', basePoints: 200, description: '200 points for referral' },
  { ruleId: 'social_share', action: 'social_share', basePoints: 25, description: '25 points for sharing' },
  { ruleId: 'repeat_visit', action: 'repeat_visit', basePoints: 100, description: '100 points for repeat visit' },
  { ruleId: 'birthday', action: 'birthday', basePoints: 500, description: '500 birthday bonus points' },
  { ruleId: 'signup', action: 'signup', basePoints: 100, description: '100 points for signup' },
];

export interface EarnPointsRequest {
  address: string;
  action: LoyaltyAction;
  amount?: number;       // For purchase: order amount in £
  metadata?: Record<string, unknown>;
}

export interface RedeemPointsRequest {
  address: string;
  points: bigint;
  rewardType: string;
  rewardId?: string;
  metadata?: Record<string, unknown>;
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  displayName?: string;
  points: bigint;
  tier: LoyaltyTier;
}

// ============================================================================
// AI CREDITS MODULE TYPES
// ============================================================================

export type CreditPackage = 'starter' | 'professional' | 'enterprise';

export interface CreditPackageConfig {
  package: CreditPackage;
  credits: number;
  priceUMTC: bigint;
  bonusCredits: number;
  description: string;
}

export const CREDIT_PACKAGES: CreditPackageConfig[] = [
  { package: 'starter', credits: 100, priceUMTC: BigInt(50000), bonusCredits: 10, description: '100 credits + 10 bonus' },
  { package: 'professional', credits: 500, priceUMTC: BigInt(200000), bonusCredits: 75, description: '500 credits + 75 bonus' },
  { package: 'enterprise', credits: 2000, priceUMTC: BigInt(700000), bonusCredits: 400, description: '2000 credits + 400 bonus' },
];

export type AIService = 
  | 'gpt4'
  | 'gpt4o'
  | 'gpt4o-mini'
  | 'claude-sonnet'
  | 'claude-opus'
  | 'claude-haiku'
  | 'gemini-pro'
  | 'gemini-flash'
  | 'local-llm'
  | 'image-gen'
  | 'voice-ai';

export interface AIServicePricing {
  service: AIService;
  creditsPerCall: number;
  description: string;
}

export const AI_SERVICE_PRICING: AIServicePricing[] = [
  { service: 'gpt4', creditsPerCall: 10, description: 'GPT-4 Turbo' },
  { service: 'gpt4o', creditsPerCall: 8, description: 'GPT-4o' },
  { service: 'gpt4o-mini', creditsPerCall: 2, description: 'GPT-4o Mini' },
  { service: 'claude-sonnet', creditsPerCall: 8, description: 'Claude Sonnet' },
  { service: 'claude-opus', creditsPerCall: 20, description: 'Claude Opus' },
  { service: 'claude-haiku', creditsPerCall: 1, description: 'Claude Haiku' },
  { service: 'gemini-pro', creditsPerCall: 5, description: 'Gemini Pro' },
  { service: 'gemini-flash', creditsPerCall: 1, description: 'Gemini Flash' },
  { service: 'local-llm', creditsPerCall: 0, description: 'Local LLM (free)' },
  { service: 'image-gen', creditsPerCall: 5, description: 'Image Generation' },
  { service: 'voice-ai', creditsPerCall: 3, description: 'Voice AI' },
];

export interface CreditBalance {
  address: string;
  totalCredits: number;
  usedCredits: number;
  availableCredits: number;
  lastPurchase?: Date;
  lastUsage?: Date;
}

export interface CreditUsageRecord {
  id: string;
  address: string;
  service: AIService;
  creditsUsed: number;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  txHash?: string;
}

export interface PurchaseCreditsRequest {
  address: string;
  package: CreditPackage;
  paymentTxHash?: string;  // If paid with MTC
}

export interface UseCreditsRequest {
  address: string;
  service: AIService;
  amount?: number;  // Override default pricing
  metadata?: Record<string, unknown>;
}

// ============================================================================
// WALLET TYPES
// ============================================================================

export type WalletType = 'custodial' | 'connected';

export interface WalletInfo {
  address: string;
  type: WalletType;
  balance: bigint;       // uMTC balance
  balanceMTC: number;    // MTC balance (decimal)
}

export interface WalletLinkRequest {
  tenantId: string;
  customerId?: string;
  walletAddress: string;
  walletType: WalletType;
  signature?: string;    // For connected wallets
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert uMTC to MTC (display format)
 */
export function uMTCtoMTC(umtc: bigint): number {
  return Number(umtc) / 1_000_000;
}

/**
 * Convert MTC to uMTC (chain format)
 */
export function MTCtouMTC(mtc: number): bigint {
  return BigInt(Math.floor(mtc * 1_000_000));
}

/**
 * Get tier for a given point balance
 */
export function getTierForPoints(points: number | bigint): LoyaltyTier {
  const pointsNum = typeof points === 'bigint' ? Number(points) : points;
  for (let i = LOYALTY_TIERS.length - 1; i >= 0; i--) {
    if (pointsNum >= LOYALTY_TIERS[i].requiredPoints) {
      return LOYALTY_TIERS[i].tier;
    }
  }
  return 'bronze';
}

/**
 * Get tier config
 */
export function getTierConfig(tier: LoyaltyTier): LoyaltyTierConfig {
  return LOYALTY_TIERS.find(t => t.tier === tier) || LOYALTY_TIERS[0];
}

/**
 * Calculate points for a purchase
 */
export function calculatePurchasePoints(
  amountGBP: number, 
  tier: LoyaltyTier
): number {
  const baseRule = DEFAULT_REWARD_RULES.find(r => r.action === 'purchase');
  const tierConfig = getTierConfig(tier);
  
  if (!baseRule) return 0;
  
  const basePoints = Math.floor(amountGBP * baseRule.basePoints);
  return Math.floor(basePoints * tierConfig.multiplier);
}

/**
 * Get service pricing
 */
export function getServicePricing(service: AIService): AIServicePricing | undefined {
  return AI_SERVICE_PRICING.find(p => p.service === service);
}
