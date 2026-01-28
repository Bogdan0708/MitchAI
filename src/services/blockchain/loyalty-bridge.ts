/**
 * Loyalty Bridge
 * Connects existing loyalty.service.ts to MTC blockchain
 * 
 * This bridge:
 * - Wraps existing loyalty operations
 * - Records transactions on MTC chain when enabled
 * - Falls back to database-only when chain is unavailable
 * - Provides caching to minimize RPC calls
 */

import { getMTCClient, MTCClient } from './mtc-client';
import {
  LoyaltyAccount,
  LoyaltyTier,
  LoyaltyAction,
  EarnPointsRequest,
  RedeemPointsRequest,
  LeaderboardEntry,
  getTierForPoints,
  getTierConfig,
  calculatePurchasePoints,
} from './types';
import { Pool } from 'pg';

// Feature flag
const MTC_LOYALTY_ENABLED = process.env.FEATURE_MTC_LOYALTY === 'true';

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

interface CachedAccount {
  account: LoyaltyAccount;
  cachedAt: number;
}

export class LoyaltyBridge {
  private mtcClient: MTCClient;
  private pool: Pool;
  private cache: Map<string, CachedAccount> = new Map();

  constructor(pool: Pool) {
    this.mtcClient = getMTCClient();
    this.pool = pool;
  }

  // ============================================================================
  // ACCOUNT OPERATIONS
  // ============================================================================

  /**
   * Get loyalty account with caching
   * Tries blockchain first if enabled, falls back to database
   */
  async getAccount(customerId: string, tenantId: string): Promise<LoyaltyAccount | null> {
    // Check cache first
    const cacheKey = `${tenantId}:${customerId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return cached.account;
    }

    try {
      // Get wallet address from database
      const walletResult = await this.pool.query(
        `SELECT chain_address FROM wallet_addresses 
         WHERE tenant_id = $1 AND customer_id = $2`,
        [tenantId, customerId]
      );

      let account: LoyaltyAccount | null = null;

      if (MTC_LOYALTY_ENABLED && walletResult.rows.length > 0) {
        // Try blockchain
        const chainAddress = walletResult.rows[0].chain_address;
        account = await this.mtcClient.getLoyaltyAccount(chainAddress);
      }

      if (!account) {
        // Fall back to database
        account = await this.getAccountFromDatabase(customerId, tenantId);
      }

      // Cache the result
      if (account) {
        this.cache.set(cacheKey, { account, cachedAt: Date.now() });
      }

      return account;
    } catch (error) {
      console.error('Failed to get loyalty account:', error);
      // Always fall back to database on error
      return this.getAccountFromDatabase(customerId, tenantId);
    }
  }

  /**
   * Get account from database (fallback)
   */
  private async getAccountFromDatabase(customerId: string, tenantId: string): Promise<LoyaltyAccount | null> {
    try {
      const result = await this.pool.query(
        `SELECT c.id, c.email, COALESCE(l.points, 0) as points, 
                COALESCE(l.lifetime_points, 0) as lifetime_points,
                COALESCE(l.tier, 'bronze') as tier
         FROM customers c
         LEFT JOIN loyalty_accounts l ON c.id = l.customer_id
         WHERE c.id = $1 AND c.tenant_id = $2`,
        [customerId, tenantId]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      const lifetimePoints = BigInt(row.lifetime_points);
      const tier = getTierForPoints(lifetimePoints);
      const tierConfig = getTierConfig(tier);

      return {
        address: row.id,  // Use customer ID as address for DB-only mode
        points: BigInt(row.points),
        tier,
        lifetimePoints,
        multiplier: tierConfig.multiplier,
        benefits: tierConfig.benefits,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('Failed to get account from database:', error);
      return null;
    }
  }

  // ============================================================================
  // POINT OPERATIONS
  // ============================================================================

  /**
   * Earn points for a customer action
   */
  async earnPoints(
    customerId: string,
    tenantId: string,
    action: LoyaltyAction,
    amount?: number,
    metadata?: Record<string, unknown>
  ): Promise<{
    success: boolean;
    pointsEarned: number;
    newBalance: bigint;
    newTier: LoyaltyTier;
    txHash?: string;
    error?: string;
  }> {
    try {
      // Get current account
      const account = await this.getAccount(customerId, tenantId);
      const currentTier = account?.tier || 'bronze';
      
      // Calculate points
      let pointsEarned: number;
      if (action === 'purchase' && amount) {
        pointsEarned = calculatePurchasePoints(amount, currentTier);
      } else {
        const { DEFAULT_REWARD_RULES } = await import('./types');
        const rule = DEFAULT_REWARD_RULES.find(r => r.action === action);
        const basePoints = rule?.basePoints || 0;
        const multiplier = account?.multiplier || 1;
        pointsEarned = Math.floor(basePoints * multiplier);
      }

      let txHash: string | undefined;

      // Record on blockchain if enabled
      if (MTC_LOYALTY_ENABLED) {
        const walletResult = await this.pool.query(
          `SELECT chain_address FROM wallet_addresses 
           WHERE tenant_id = $1 AND customer_id = $2`,
          [tenantId, customerId]
        );

        if (walletResult.rows.length > 0) {
          const request: EarnPointsRequest = {
            address: walletResult.rows[0].chain_address,
            action,
            amount,
            metadata,
          };
          const result = await this.mtcClient.earnPoints(request);
          if (result.success) {
            txHash = result.txHash;
          }
        }
      }

      // Always update database (source of truth for offline scenarios)
      await this.updateDatabasePoints(customerId, tenantId, pointsEarned, action, txHash);

      // Invalidate cache
      this.cache.delete(`${tenantId}:${customerId}`);

      // Get updated account
      const updatedAccount = await this.getAccount(customerId, tenantId);
      
      return {
        success: true,
        pointsEarned,
        newBalance: updatedAccount?.points || 0n,
        newTier: updatedAccount?.tier || 'bronze',
        txHash,
      };
    } catch (error) {
      console.error('Failed to earn points:', error);
      return {
        success: false,
        pointsEarned: 0,
        newBalance: 0n,
        newTier: 'bronze',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Redeem points for a reward
   */
  async redeemPoints(
    customerId: string,
    tenantId: string,
    points: bigint,
    rewardType: string,
    rewardId?: string,
    metadata?: Record<string, unknown>
  ): Promise<{
    success: boolean;
    pointsRedeemed: bigint;
    newBalance: bigint;
    txHash?: string;
    error?: string;
  }> {
    try {
      // Check current balance
      const account = await this.getAccount(customerId, tenantId);
      if (!account || account.points < points) {
        return {
          success: false,
          pointsRedeemed: 0n,
          newBalance: account?.points || 0n,
          error: 'Insufficient points',
        };
      }

      let txHash: string | undefined;

      // Record on blockchain if enabled
      if (MTC_LOYALTY_ENABLED) {
        const walletResult = await this.pool.query(
          `SELECT chain_address FROM wallet_addresses 
           WHERE tenant_id = $1 AND customer_id = $2`,
          [tenantId, customerId]
        );

        if (walletResult.rows.length > 0) {
          const request: RedeemPointsRequest = {
            address: walletResult.rows[0].chain_address,
            points,
            rewardType,
            rewardId,
            metadata,
          };
          const result = await this.mtcClient.redeemPoints(request);
          if (!result.success) {
            return {
              success: false,
              pointsRedeemed: 0n,
              newBalance: account.points,
              error: result.error,
            };
          }
          txHash = result.txHash;
        }
      }

      // Update database
      await this.pool.query(
        `UPDATE loyalty_accounts 
         SET points = points - $1, updated_at = NOW()
         WHERE customer_id = $2 AND tenant_id = $3`,
        [points.toString(), customerId, tenantId]
      );

      // Record redemption
      await this.pool.query(
        `INSERT INTO loyalty_redemptions 
         (customer_id, tenant_id, points_redeemed, reward_type, reward_id, tx_hash, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [customerId, tenantId, points.toString(), rewardType, rewardId, txHash, JSON.stringify(metadata)]
      );

      // Invalidate cache
      this.cache.delete(`${tenantId}:${customerId}`);

      // Get updated account
      const updatedAccount = await this.getAccount(customerId, tenantId);

      return {
        success: true,
        pointsRedeemed: points,
        newBalance: updatedAccount?.points || 0n,
        txHash,
      };
    } catch (error) {
      console.error('Failed to redeem points:', error);
      return {
        success: false,
        pointsRedeemed: 0n,
        newBalance: 0n,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update database with earned points
   */
  private async updateDatabasePoints(
    customerId: string,
    tenantId: string,
    points: number,
    action: LoyaltyAction,
    txHash?: string
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Upsert loyalty account
      await client.query(
        `INSERT INTO loyalty_accounts (customer_id, tenant_id, points, lifetime_points)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (customer_id, tenant_id)
         DO UPDATE SET 
           points = loyalty_accounts.points + $3,
           lifetime_points = loyalty_accounts.lifetime_points + $3,
           updated_at = NOW()`,
        [customerId, tenantId, points]
      );

      // Update tier based on new lifetime points
      await client.query(
        `UPDATE loyalty_accounts
         SET tier = CASE
           WHEN lifetime_points >= 20000 THEN 'platinum'
           WHEN lifetime_points >= 5000 THEN 'gold'
           WHEN lifetime_points >= 1000 THEN 'silver'
           ELSE 'bronze'
         END
         WHERE customer_id = $1 AND tenant_id = $2`,
        [customerId, tenantId]
      );

      // Record transaction
      await client.query(
        `INSERT INTO loyalty_transactions 
         (customer_id, tenant_id, points, action, tx_hash)
         VALUES ($1, $2, $3, $4, $5)`,
        [customerId, tenantId, points, action, txHash]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // LEADERBOARD
  // ============================================================================

  /**
   * Get loyalty leaderboard for a tenant
   */
  async getLeaderboard(tenantId: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    try {
      // Get from database (more reliable for tenant-specific data)
      const result = await this.pool.query(
        `SELECT c.id, c.first_name, c.last_name, l.points, l.lifetime_points, l.tier
         FROM customers c
         JOIN loyalty_accounts l ON c.id = l.customer_id
         WHERE c.tenant_id = $1
         ORDER BY l.points DESC
         LIMIT $2`,
        [tenantId, limit]
      );

      return result.rows.map((row, index) => ({
        rank: index + 1,
        address: row.id,
        displayName: `${row.first_name} ${row.last_name?.[0] || ''}.`,
        points: BigInt(row.points),
        tier: row.tier as LoyaltyTier,
      }));
    } catch (error) {
      console.error('Failed to get leaderboard:', error);
      return [];
    }
  }

  // ============================================================================
  // WALLET MANAGEMENT
  // ============================================================================

  /**
   * Link a wallet address to a customer
   */
  async linkWallet(
    customerId: string,
    tenantId: string,
    chainAddress: string,
    walletType: 'custodial' | 'connected'
  ): Promise<boolean> {
    try {
      await this.pool.query(
        `INSERT INTO wallet_addresses (tenant_id, customer_id, chain_address, wallet_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (chain_address) 
         DO UPDATE SET tenant_id = $1, customer_id = $2, wallet_type = $4`,
        [tenantId, customerId, chainAddress, walletType]
      );
      return true;
    } catch (error) {
      console.error('Failed to link wallet:', error);
      return false;
    }
  }

  /**
   * Get wallet address for a customer
   */
  async getWalletAddress(customerId: string, tenantId: string): Promise<string | null> {
    try {
      const result = await this.pool.query(
        `SELECT chain_address FROM wallet_addresses
         WHERE tenant_id = $1 AND customer_id = $2`,
        [tenantId, customerId]
      );
      return result.rows[0]?.chain_address || null;
    } catch (error) {
      console.error('Failed to get wallet address:', error);
      return null;
    }
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * Clear cache for a specific customer
   */
  clearCache(customerId: string, tenantId: string): void {
    this.cache.delete(`${tenantId}:${customerId}`);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
  }
}

// Export singleton factory
let loyaltyBridgeInstance: LoyaltyBridge | null = null;

export function getLoyaltyBridge(pool: Pool): LoyaltyBridge {
  if (!loyaltyBridgeInstance) {
    loyaltyBridgeInstance = new LoyaltyBridge(pool);
  }
  return loyaltyBridgeInstance;
}

export default LoyaltyBridge;
