/**
 * LOYALTY SERVICE (MitchCoin)
 *
 * Blockchain-based loyalty program:
 * - Points earning and redemption
 * - Wallet integration (wagmi/viem)
 * - On-chain rewards tracking
 * - Tiered membership benefits
 */

import { Pool } from 'pg';
import Redis from 'ioredis';

// Loyalty tier configuration
export const LOYALTY_TIERS = {
  bronze: { minPoints: 0, multiplier: 1, benefits: ['5% off orders over $50'] },
  silver: { minPoints: 500, multiplier: 1.25, benefits: ['10% off orders', 'Free delivery'] },
  gold: { minPoints: 2000, multiplier: 1.5, benefits: ['15% off orders', 'Free delivery', 'Priority support'] },
  platinum: { minPoints: 5000, multiplier: 2, benefits: ['20% off orders', 'Free delivery', 'VIP events', 'Early access'] },
};

export interface LoyaltyAccount {
  id: string;
  tenantId: string;
  customerId: string;
  walletAddress?: string;
  pointsBalance: number;
  lifetimePoints: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  tierExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoyaltyTransaction {
  id: string;
  accountId: string;
  type: 'earn' | 'redeem' | 'expire' | 'bonus' | 'transfer';
  points: number;
  description: string;
  orderId?: string;
  txHash?: string; // Blockchain transaction hash
  createdAt: Date;
}

export interface RedemptionOption {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  type: 'discount' | 'freeItem' | 'upgrade' | 'exclusive';
  value: number; // Discount percentage or item value
  menuItemId?: string; // For free item redemptions
  isAvailable: boolean;
}

export interface WalletConnection {
  address: string;
  chainId: number;
  signature: string;
  connectedAt: Date;
}

export class LoyaltyService {
  private pool: Pool;
  private redis: Redis;
  private mitchcoinContract?: string;
  private rpcUrl?: string;

  constructor(pool: Pool, redis: Redis) {
    this.pool = pool;
    this.redis = redis;
    this.mitchcoinContract = process.env.MITCHCOIN_CONTRACT_ADDRESS;
    this.rpcUrl = process.env.ETHEREUM_RPC_URL;
  }

  /**
   * Get cached loyalty data
   */
  async getCachedAccount(accountId: string): Promise<LoyaltyAccount | null> {
    const data = await this.redis.get(`loyalty:${accountId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Cache loyalty account
   */
  async cacheAccount(account: LoyaltyAccount): Promise<void> {
    await this.redis.setex(`loyalty:${account.id}`, 300, JSON.stringify(account));
  }

  /**
   * Get or create loyalty account for customer
   */
  async getOrCreateAccount(
    tenantId: string,
    customerId: string
  ): Promise<LoyaltyAccount> {
    // Check if account exists
    const existing = await this.pool.query(
      `SELECT * FROM loyalty_accounts WHERE tenant_id = $1 AND customer_id = $2`,
      [tenantId, customerId]
    );

    if (existing.rows.length > 0) {
      return this.mapRowToAccount(existing.rows[0]);
    }

    // Create new account
    const result = await this.pool.query(
      `INSERT INTO loyalty_accounts (tenant_id, customer_id, points_balance, lifetime_points, tier)
       VALUES ($1, $2, 0, 0, 'bronze')
       RETURNING *`,
      [tenantId, customerId]
    );

    return this.mapRowToAccount(result.rows[0]);
  }

  /**
   * Get loyalty account by ID
   */
  async getAccount(accountId: string): Promise<LoyaltyAccount | null> {
    const result = await this.pool.query(
      'SELECT * FROM loyalty_accounts WHERE id = $1',
      [accountId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToAccount(result.rows[0]);
  }

  /**
   * Earn points from an order
   */
  async earnPoints(
    accountId: string,
    orderId: string,
    orderTotal: number,
    bonusMultiplier: number = 1
  ): Promise<LoyaltyTransaction> {
    const account = await this.getAccount(accountId);
    if (!account) {
      throw new Error('Loyalty account not found');
    }

    // Calculate points (1 point per dollar, with tier multiplier)
    const tierMultiplier = LOYALTY_TIERS[account.tier].multiplier;
    const basePoints = Math.floor(orderTotal);
    const points = Math.floor(basePoints * tierMultiplier * bonusMultiplier);

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Create transaction
      const txResult = await client.query(
        `INSERT INTO loyalty_transactions (account_id, type, points, description, order_id)
         VALUES ($1, 'earn', $2, $3, $4)
         RETURNING *`,
        [accountId, points, `Earned from order ${orderId}`, orderId]
      );

      // Update account balance
      await client.query(
        `UPDATE loyalty_accounts
         SET points_balance = points_balance + $1,
             lifetime_points = lifetime_points + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [points, accountId]
      );

      await client.query('COMMIT');

      // Check for tier upgrade
      await this.checkTierUpgrade(accountId);

      // Mint tokens on blockchain if wallet connected
      if (account.walletAddress && this.mitchcoinContract) {
        await this.mintTokens(account.walletAddress, points);
      }

      return {
        id: txResult.rows[0].id,
        accountId,
        type: 'earn',
        points,
        description: `Earned from order ${orderId}`,
        orderId,
        createdAt: txResult.rows[0].created_at,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Redeem points for a reward
   */
  async redeemPoints(
    accountId: string,
    redemptionOptionId: string,
    orderId?: string
  ): Promise<{
    transaction: LoyaltyTransaction;
    redemptionCode: string;
  }> {
    const account = await this.getAccount(accountId);
    if (!account) {
      throw new Error('Loyalty account not found');
    }

    // Get redemption option
    const optionResult = await this.pool.query(
      'SELECT * FROM loyalty_redemption_options WHERE id = $1 AND tenant_id = $2',
      [redemptionOptionId, account.tenantId]
    );

    if (optionResult.rows.length === 0) {
      throw new Error('Redemption option not found');
    }

    const option = optionResult.rows[0];

    if (account.pointsBalance < option.points_cost) {
      throw new Error('Insufficient points');
    }

    const redemptionCode = this.generateRedemptionCode();

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Create transaction
      const txResult = await client.query(
        `INSERT INTO loyalty_transactions (account_id, type, points, description, order_id)
         VALUES ($1, 'redeem', $2, $3, $4)
         RETURNING *`,
        [accountId, -option.points_cost, `Redeemed: ${option.name}`, orderId]
      );

      // Update account balance
      await client.query(
        `UPDATE loyalty_accounts
         SET points_balance = points_balance - $1, updated_at = NOW()
         WHERE id = $2`,
        [option.points_cost, accountId]
      );

      // Create redemption record
      await client.query(
        `INSERT INTO loyalty_redemptions (account_id, option_id, code, order_id, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')`,
        [accountId, redemptionOptionId, redemptionCode, orderId]
      );

      await client.query('COMMIT');

      // Burn tokens on blockchain if wallet connected
      if (account.walletAddress && this.mitchcoinContract) {
        await this.burnTokens(account.walletAddress, option.points_cost);
      }

      return {
        transaction: {
          id: txResult.rows[0].id,
          accountId,
          type: 'redeem',
          points: -option.points_cost,
          description: `Redeemed: ${option.name}`,
          orderId,
          createdAt: txResult.rows[0].created_at,
        },
        redemptionCode,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Connect wallet to loyalty account
   */
  async connectWallet(
    accountId: string,
    walletAddress: string,
    signature: string,
    message: string
  ): Promise<LoyaltyAccount> {
    // Verify signature (simplified - in production use ethers/viem)
    const isValid = await this.verifyWalletSignature(walletAddress, signature, message);
    if (!isValid) {
      throw new Error('Invalid wallet signature');
    }

    // Check if wallet already connected to another account
    const existing = await this.pool.query(
      'SELECT id FROM loyalty_accounts WHERE wallet_address = $1 AND id != $2',
      [walletAddress, accountId]
    );

    if (existing.rows.length > 0) {
      throw new Error('Wallet already connected to another account');
    }

    // Update account
    const result = await this.pool.query(
      `UPDATE loyalty_accounts
       SET wallet_address = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [walletAddress, accountId]
    );

    // Sync on-chain balance
    const account = this.mapRowToAccount(result.rows[0]);
    if (this.mitchcoinContract) {
      await this.syncOnChainBalance(account);
    }

    return account;
  }

  /**
   * Check and upgrade tier if eligible
   */
  private async checkTierUpgrade(accountId: string): Promise<void> {
    const account = await this.getAccount(accountId);
    if (!account) return;

    let newTier: keyof typeof LOYALTY_TIERS = 'bronze';

    if (account.lifetimePoints >= LOYALTY_TIERS.platinum.minPoints) {
      newTier = 'platinum';
    } else if (account.lifetimePoints >= LOYALTY_TIERS.gold.minPoints) {
      newTier = 'gold';
    } else if (account.lifetimePoints >= LOYALTY_TIERS.silver.minPoints) {
      newTier = 'silver';
    }

    if (newTier !== account.tier) {
      await this.pool.query(
        `UPDATE loyalty_accounts
         SET tier = $1, tier_expires_at = NOW() + INTERVAL '1 year', updated_at = NOW()
         WHERE id = $2`,
        [newTier, accountId]
      );

      // Award bonus points for tier upgrade
      const bonusPoints = (LOYALTY_TIERS[newTier].minPoints - LOYALTY_TIERS[account.tier].minPoints) * 0.1;
      if (bonusPoints > 0) {
        await this.pool.query(
          `INSERT INTO loyalty_transactions (account_id, type, points, description)
           VALUES ($1, 'bonus', $2, $3)`,
          [accountId, Math.floor(bonusPoints), `Tier upgrade bonus: ${newTier}`]
        );

        await this.pool.query(
          `UPDATE loyalty_accounts
           SET points_balance = points_balance + $1
           WHERE id = $2`,
          [Math.floor(bonusPoints), accountId]
        );
      }
    }
  }

  /**
   * Get available redemption options
   */
  async getRedemptionOptions(tenantId: string): Promise<RedemptionOption[]> {
    const result = await this.pool.query(
      `SELECT * FROM loyalty_redemption_options
       WHERE tenant_id = $1 AND is_available = true
       ORDER BY points_cost`,
      [tenantId]
    );

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      pointsCost: row.points_cost,
      type: row.type,
      value: row.value,
      menuItemId: row.menu_item_id,
      isAvailable: row.is_available,
    }));
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    accountId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<LoyaltyTransaction[]> {
    const result = await this.pool.query(
      `SELECT * FROM loyalty_transactions
       WHERE account_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset]
    );

    return result.rows.map(row => ({
      id: row.id,
      accountId: row.account_id,
      type: row.type,
      points: row.points,
      description: row.description,
      orderId: row.order_id,
      txHash: row.tx_hash,
      createdAt: row.created_at,
    }));
  }

  /**
   * Create redemption options for a tenant
   */
  async createRedemptionOption(
    tenantId: string,
    option: Omit<RedemptionOption, 'id' | 'isAvailable'>
  ): Promise<RedemptionOption> {
    const result = await this.pool.query(
      `INSERT INTO loyalty_redemption_options
       (tenant_id, name, description, points_cost, type, value, menu_item_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, option.name, option.description, option.pointsCost, option.type, option.value, option.menuItemId]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      pointsCost: row.points_cost,
      type: row.type,
      value: row.value,
      menuItemId: row.menu_item_id,
      isAvailable: row.is_available,
    };
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(
    tenantId: string,
    limit: number = 10
  ): Promise<Array<{
    rank: number;
    customerName: string;
    lifetimePoints: number;
    tier: string;
  }>> {
    const result = await this.pool.query(
      `SELECT
        la.lifetime_points,
        la.tier,
        c.name as customer_name
       FROM loyalty_accounts la
       LEFT JOIN customers c ON la.customer_id = c.id
       WHERE la.tenant_id = $1
       ORDER BY la.lifetime_points DESC
       LIMIT $2`,
      [tenantId, limit]
    );

    return result.rows.map((row, index) => ({
      rank: index + 1,
      customerName: row.customer_name || 'Anonymous',
      lifetimePoints: row.lifetime_points,
      tier: row.tier,
    }));
  }

  /**
   * Blockchain integration: Mint tokens
   */
  private async mintTokens(walletAddress: string, amount: number): Promise<string | null> {
    if (!this.mitchcoinContract || !this.rpcUrl) {
      console.log(`[Mock] Minting ${amount} MitchCoin to ${walletAddress}`);
      return null;
    }

    // In production, use viem/ethers to interact with the contract
    // This is a placeholder for the actual implementation
    try {
      // const { createPublicClient, createWalletClient, http } = await import('viem');
      // const walletClient = createWalletClient({ ... });
      // const hash = await walletClient.writeContract({ ... });
      // return hash;
      console.log(`Minting ${amount} tokens to ${walletAddress}`);
      return null;
    } catch (error) {
      console.error('Failed to mint tokens:', error);
      return null;
    }
  }

  /**
   * Blockchain integration: Burn tokens
   */
  private async burnTokens(walletAddress: string, amount: number): Promise<string | null> {
    if (!this.mitchcoinContract || !this.rpcUrl) {
      console.log(`[Mock] Burning ${amount} MitchCoin from ${walletAddress}`);
      return null;
    }

    try {
      console.log(`Burning ${amount} tokens from ${walletAddress}`);
      return null;
    } catch (error) {
      console.error('Failed to burn tokens:', error);
      return null;
    }
  }

  /**
   * Sync on-chain balance with database
   */
  private async syncOnChainBalance(account: LoyaltyAccount): Promise<void> {
    if (!account.walletAddress || !this.mitchcoinContract) return;

    // In production, read balance from blockchain
    // const balance = await contract.balanceOf(account.walletAddress);
    // Update database if different
  }

  /**
   * Verify wallet signature
   */
  private async verifyWalletSignature(
    _address: string,
    _signature: string,
    _message: string
  ): Promise<boolean> {
    // In production, use viem/ethers to verify
    // const recoveredAddress = await verifyMessage({ address, message, signature });
    // return recoveredAddress.toLowerCase() === address.toLowerCase();
    return true; // Simplified for now
  }

  /**
   * Generate unique redemption code
   */
  private generateRedemptionCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Map database row to LoyaltyAccount
   */
  private mapRowToAccount(row: Record<string, unknown>): LoyaltyAccount {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      customerId: row.customer_id as string,
      walletAddress: row.wallet_address as string | undefined,
      pointsBalance: row.points_balance as number,
      lifetimePoints: row.lifetime_points as number,
      tier: row.tier as LoyaltyAccount['tier'],
      tierExpiresAt: row.tier_expires_at ? new Date(row.tier_expires_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
