/**
 * MTC Client
 * Cosmos SDK client wrapper for Mitch Chain
 * 
 * Handles communication with the mitch-chain blockchain for:
 * - Loyalty point operations
 * - AI credit management
 * - Wallet queries
 */

import {
  MTCConfig,
  TxResult,
  LoyaltyAccount,
  EarnPointsRequest,
  RedeemPointsRequest,
  LeaderboardEntry,
  CreditBalance,
  CreditUsageRecord,
  PurchaseCreditsRequest,
  UseCreditsRequest,
  WalletInfo,
  AIService,
  getTierForPoints,
  getTierConfig,
  calculatePurchasePoints,
  getServicePricing,
  uMTCtoMTC,
} from './types';

// Response types for API calls
interface NodeInfoResponse {
  default_node_info: { network: string };
}

interface BalancesResponse {
  balances?: Array<{ denom: string; amount: string }>;
}

interface LoyaltyAccountResponse {
  loyalty_account: {
    points?: string;
    lifetime_points?: string;
  };
}

interface LeaderboardResponse {
  entries?: Array<{
    address: string;
    display_name?: string;
    points?: string;
    lifetime_points?: string;
  }>;
}

interface CreditAccountResponse {
  credit_account: {
    total_credits?: string;
    used_credits?: string;
    available_credits?: string;
    last_purchase?: string;
    last_usage?: string;
  };
}

interface CreditHistoryResponse {
  records?: Array<{
    id: string;
    address: string;
    service: string;
    credits_used?: string;
    metadata?: Record<string, unknown>;
    timestamp: string;
    tx_hash?: string;
  }>;
}

// Environment-based configuration
const DEFAULT_CONFIG: MTCConfig = {
  rpcUrl: process.env.MTC_RPC_URL || 'http://localhost:26657',
  restUrl: process.env.MTC_REST_URL || 'http://localhost:1317',
  chainId: process.env.MTC_CHAIN_ID || 'mitch-1',
  denom: process.env.MTC_DENOM || 'uMTC',
  gasPrice: '0.025uMTC',
};

export class MTCClient {
  private config: MTCConfig;
  private connected: boolean = false;

  constructor(config: Partial<MTCConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================================
  // CONNECTION
  // ============================================================================

  /**
   * Test connection to the chain
   */
  async connect(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.restUrl}/cosmos/base/tendermint/v1beta1/node_info`);
      if (response.ok) {
        const data = await response.json() as NodeInfoResponse;
        console.log(`Connected to ${data.default_node_info.network}`);
        this.connected = true;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to connect to MTC chain:', error);
      this.connected = false;
      return false;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  // ============================================================================
  // WALLET OPERATIONS
  // ============================================================================

  /**
   * Get wallet info including MTC balance
   */
  async getWalletInfo(address: string): Promise<WalletInfo | null> {
    try {
      const response = await fetch(
        `${this.config.restUrl}/cosmos/bank/v1beta1/balances/${address}`
      );
      
      if (!response.ok) return null;
      
      const data = await response.json() as BalancesResponse;
      const mtcBalance = data.balances?.find(b => b.denom === this.config.denom);
      const balanceUMTC = BigInt(mtcBalance?.amount || '0');
      
      return {
        address,
        type: 'connected', // Assume connected; custodial handled separately
        balance: balanceUMTC,
        balanceMTC: uMTCtoMTC(balanceUMTC),
      };
    } catch (error) {
      console.error('Failed to get wallet info:', error);
      return null;
    }
  }

  // ============================================================================
  // LOYALTY OPERATIONS
  // ============================================================================

  /**
   * Get loyalty account for an address
   */
  async getLoyaltyAccount(address: string): Promise<LoyaltyAccount | null> {
    try {
      const response = await fetch(
        `${this.config.restUrl}/mitch/app/v1/loyalty_account/${address}`
      );
      
      if (!response.ok) {
        // Return default account for new users
        return {
          address,
          points: BigInt(0),
          tier: 'bronze',
          lifetimePoints: BigInt(0),
          multiplier: 1.0,
          benefits: ['basic_rewards'],
          lastUpdated: new Date(),
        };
      }
      
      const data = await response.json() as LoyaltyAccountResponse;
      const account = data.loyalty_account;
      const points = BigInt(account.points || '0');
      const lifetimePoints = BigInt(account.lifetime_points || '0');
      const tier = getTierForPoints(lifetimePoints);
      const tierConfig = getTierConfig(tier);
      
      return {
        address,
        points,
        tier,
        lifetimePoints,
        multiplier: tierConfig.multiplier,
        benefits: tierConfig.benefits,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('Failed to get loyalty account:', error);
      return null;
    }
  }

  /**
   * Earn loyalty points
   * Note: In production, this would create and broadcast a transaction
   * For MVP, we simulate the response
   */
  async earnPoints(request: EarnPointsRequest): Promise<TxResult> {
    try {
      // Get current account to calculate tier multiplier
      const account = await this.getLoyaltyAccount(request.address);
      const tier = account?.tier || 'bronze';
      
      // Calculate points based on action
      let points: number;
      if (request.action === 'purchase' && request.amount) {
        points = calculatePurchasePoints(request.amount, tier);
      } else {
        // Use default points for other actions
        const rule = (await import('./types')).DEFAULT_REWARD_RULES.find(
          r => r.action === request.action
        );
        points = rule?.basePoints || 0;
        points = Math.floor(points * (account?.multiplier || 1));
      }

      // In production: broadcast transaction to chain
      // For MVP: simulate success
      console.log(`[MTC] Earning ${points} points for ${request.address} (${request.action})`);
      
      return {
        success: true,
        txHash: `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        height: 0,
        gasUsed: 50000,
      };
    } catch (error) {
      console.error('Failed to earn points:', error);
      return {
        success: false,
        txHash: '',
        height: 0,
        gasUsed: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Redeem loyalty points
   */
  async redeemPoints(request: RedeemPointsRequest): Promise<TxResult> {
    try {
      const account = await this.getLoyaltyAccount(request.address);
      
      if (!account || account.points < request.points) {
        return {
          success: false,
          txHash: '',
          height: 0,
          gasUsed: 0,
          error: 'Insufficient points',
        };
      }

      // In production: broadcast transaction to chain
      console.log(`[MTC] Redeeming ${request.points} points for ${request.address}`);
      
      return {
        success: true,
        txHash: `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        height: 0,
        gasUsed: 60000,
      };
    } catch (error) {
      console.error('Failed to redeem points:', error);
      return {
        success: false,
        txHash: '',
        height: 0,
        gasUsed: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get loyalty leaderboard
   */
  async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    try {
      const response = await fetch(
        `${this.config.restUrl}/mitch/app/v1/leaderboard?limit=${limit}`
      );
      
      if (!response.ok) {
        return [];
      }
      
      const data = await response.json() as LeaderboardResponse;
      return (data.entries || []).map((entry, index) => ({
        rank: index + 1,
        address: entry.address,
        displayName: entry.display_name,
        points: BigInt(entry.points || '0'),
        tier: getTierForPoints(BigInt(entry.lifetime_points || '0')),
      }));
    } catch (error) {
      console.error('Failed to get leaderboard:', error);
      return [];
    }
  }

  // ============================================================================
  // AI CREDITS OPERATIONS
  // ============================================================================

  /**
   * Get AI credit balance
   */
  async getCreditBalance(address: string): Promise<CreditBalance | null> {
    try {
      const response = await fetch(
        `${this.config.restUrl}/mitch/app/v1/credits/${address}`
      );
      
      if (!response.ok) {
        // Return default balance for new users
        return {
          address,
          totalCredits: 0,
          usedCredits: 0,
          availableCredits: 0,
        };
      }
      
      const data = await response.json() as CreditAccountResponse;
      const credits = data.credit_account;
      
      return {
        address,
        totalCredits: parseInt(credits.total_credits || '0'),
        usedCredits: parseInt(credits.used_credits || '0'),
        availableCredits: parseInt(credits.available_credits || '0'),
        lastPurchase: credits.last_purchase ? new Date(credits.last_purchase) : undefined,
        lastUsage: credits.last_usage ? new Date(credits.last_usage) : undefined,
      };
    } catch (error) {
      console.error('Failed to get credit balance:', error);
      return null;
    }
  }

  /**
   * Purchase AI credits
   */
  async purchaseCredits(request: PurchaseCreditsRequest): Promise<TxResult> {
    try {
      const { CREDIT_PACKAGES } = await import('./types');
      const packageConfig = CREDIT_PACKAGES.find(p => p.package === request.package);
      
      if (!packageConfig) {
        return {
          success: false,
          txHash: '',
          height: 0,
          gasUsed: 0,
          error: 'Invalid credit package',
        };
      }

      // In production: broadcast transaction to chain
      const totalCredits = packageConfig.credits + packageConfig.bonusCredits;
      console.log(`[MTC] Purchasing ${totalCredits} credits for ${request.address}`);
      
      return {
        success: true,
        txHash: `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        height: 0,
        gasUsed: 80000,
      };
    } catch (error) {
      console.error('Failed to purchase credits:', error);
      return {
        success: false,
        txHash: '',
        height: 0,
        gasUsed: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Use AI credits
   */
  async useCredits(request: UseCreditsRequest): Promise<TxResult> {
    try {
      const balance = await this.getCreditBalance(request.address);
      const pricing = getServicePricing(request.service);
      const creditsNeeded = request.amount || pricing?.creditsPerCall || 1;
      
      if (!balance || balance.availableCredits < creditsNeeded) {
        return {
          success: false,
          txHash: '',
          height: 0,
          gasUsed: 0,
          error: 'Insufficient credits',
        };
      }

      // In production: broadcast transaction to chain
      console.log(`[MTC] Using ${creditsNeeded} credits for ${request.service}`);
      
      return {
        success: true,
        txHash: `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        height: 0,
        gasUsed: 45000,
      };
    } catch (error) {
      console.error('Failed to use credits:', error);
      return {
        success: false,
        txHash: '',
        height: 0,
        gasUsed: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get credit usage history
   */
  async getCreditHistory(address: string, limit: number = 20): Promise<CreditUsageRecord[]> {
    try {
      const response = await fetch(
        `${this.config.restUrl}/mitch/app/v1/credit_history/${address}?limit=${limit}`
      );
      
      if (!response.ok) {
        return [];
      }
      
      const data = await response.json() as CreditHistoryResponse;
      return (data.records || []).map(record => ({
        id: record.id,
        address: record.address,
        service: record.service as AIService,
        creditsUsed: parseInt(record.credits_used || '0'),
        metadata: record.metadata,
        timestamp: new Date(record.timestamp),
        txHash: record.tx_hash,
      }));
    } catch (error) {
      console.error('Failed to get credit history:', error);
      return [];
    }
  }
}

// Singleton instance
let mtcClientInstance: MTCClient | null = null;

/**
 * Get or create MTC client instance
 */
export function getMTCClient(config?: Partial<MTCConfig>): MTCClient {
  if (!mtcClientInstance) {
    mtcClientInstance = new MTCClient(config);
  }
  return mtcClientInstance;
}

/**
 * Reset client (for testing)
 */
export function resetMTCClient(): void {
  mtcClientInstance = null;
}

export default MTCClient;
