/**
 * BLOCKCHAIN API ROUTES
 * 
 * MTC Chain endpoints for:
 * - Wallet management
 * - Loyalty points (earn/redeem/leaderboard)
 * - AI credits (purchase/use/balance)
 * - Chain status
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { getMTCClient } from '../services/blockchain/mtc-client';
import { 
  LoyaltyAction, 
  CreditPackage,
  AIService,
  CREDIT_PACKAGES,
  AI_SERVICE_PRICING,
  DEFAULT_REWARD_RULES,
  getTierForPoints,
  getTierConfig,
  getServicePricing
} from '../services/blockchain/types';
import { logger } from '../services/logger.service';

// Import to trigger type augmentation
import '../middleware/tenant.middleware';

// ============================================================================
// VALIDATORS
// ============================================================================

const connectWalletSchema = z.object({
  address: z.string().regex(/^mitch1[a-z0-9]{38,}$/, 'Invalid Mitch wallet address'),
  signature: z.string().optional(),
  label: z.string().max(100).optional()
});

const earnPointsSchema = z.object({
  walletAddress: z.string().regex(/^mitch1[a-z0-9]{38,}$/),
  action: z.enum(['purchase', 'review', 'referral', 'social_share', 'repeat_visit', 'birthday', 'signup'] as const),
  amount: z.number().positive().optional(), // For purchase actions
  metadata: z.record(z.unknown()).optional()
});

const redeemPointsSchema = z.object({
  walletAddress: z.string().regex(/^mitch1[a-z0-9]{38,}$/),
  points: z.number().int().positive(),
  rewardType: z.string(),
  metadata: z.record(z.unknown()).optional()
});

const purchaseCreditsSchema = z.object({
  walletAddress: z.string().regex(/^mitch1[a-z0-9]{38,}$/),
  package: z.enum(['starter', 'professional', 'enterprise'] as const)
});

const useCreditsSchema = z.object({
  walletAddress: z.string().regex(/^mitch1[a-z0-9]{38,}$/),
  service: z.enum([
    'gpt4', 'gpt4o', 'gpt4o-mini',
    'claude-sonnet', 'claude-opus', 'claude-haiku',
    'gemini-pro', 'gemini-flash',
    'llama-70b', 'mixtral',
    'dalle3', 'stable-diffusion',
    'whisper', 'tts'
  ] as const),
  units: z.number().int().positive().optional().default(1)
});

// ============================================================================
// ROUTE FACTORY
// ============================================================================

export function createBlockchainRoutes(pool: Pool): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // GET /api/blockchain/status - Chain connection status
  // -------------------------------------------------------------------------
  router.get('/status', async (req, res, next) => {
    try {
      const client = getMTCClient();
      const isConnected = client.isConnected();

      res.json({
        connected: isConnected,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/blockchain/wallets - List tenant's connected wallets
  // -------------------------------------------------------------------------
  router.get('/wallets', async (req, res, next) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const result = await pool.query(
        `SELECT id, address, wallet_type, label, is_verified,
                cached_balance_umtc, cached_loyalty_points, cached_loyalty_tier,
                cached_ai_credits, is_primary, created_at
         FROM wallet_addresses
         WHERE tenant_id = $1 AND deleted_at IS NULL
         ORDER BY is_primary DESC, created_at`,
        [tenantId]
      );

      res.json({
        wallets: result.rows.map(row => ({
          id: row.id,
          address: row.address,
          type: row.wallet_type,
          label: row.label,
          isVerified: row.is_verified,
          isPrimary: row.is_primary,
          balance: {
            umtc: row.cached_balance_umtc,
            mtc: Number(row.cached_balance_umtc) / 1_000_000
          },
          loyalty: {
            points: row.cached_loyalty_points,
            tier: row.cached_loyalty_tier
          },
          aiCredits: row.cached_ai_credits,
          createdAt: row.created_at
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/blockchain/wallets - Connect a wallet
  // -------------------------------------------------------------------------
  router.post('/wallets', async (req, res, next) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const body = connectWalletSchema.parse(req.body);

      // Check if wallet already connected
      const existing = await pool.query(
        'SELECT id FROM wallet_addresses WHERE tenant_id = $1 AND address = $2 AND deleted_at IS NULL',
        [tenantId, body.address]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Wallet already connected' });
      }

      // Determine wallet type
      const walletType = body.signature ? 'connected' : 'custodial';

      // Check if this is the first wallet (make it primary)
      const walletCount = await pool.query(
        'SELECT COUNT(*) FROM wallet_addresses WHERE tenant_id = $1 AND deleted_at IS NULL',
        [tenantId]
      );
      const isPrimary = parseInt(walletCount.rows[0].count, 10) === 0;

      // Get on-chain balance if available
      let cachedBalance = 0;
      let cachedPoints = 0;
      let cachedTier = 'bronze';
      let cachedCredits = 0;

      try {
        const client = getMTCClient();
        if (client.isConnected()) {
          const walletInfo = await client.getWalletInfo(body.address);
          if (walletInfo) {
            cachedBalance = Number(walletInfo.balance);
          }

          const loyaltyAccount = await client.getLoyaltyAccount(body.address);
          if (loyaltyAccount) {
            cachedPoints = Number(loyaltyAccount.points);
            cachedTier = loyaltyAccount.tier;
          }

          const creditBalance = await client.getCreditBalance(body.address);
          if (creditBalance) {
            cachedCredits = creditBalance.availableCredits;
          }
        }
      } catch (e) {
        logger.warn('Failed to fetch on-chain data', { address: body.address, error: e });
      }

      const result = await pool.query(
        `INSERT INTO wallet_addresses 
         (tenant_id, address, wallet_type, label, is_verified, is_primary,
          cached_balance_umtc, cached_loyalty_points, cached_loyalty_tier, cached_ai_credits, cache_updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         RETURNING id`,
        [
          tenantId,
          body.address,
          walletType,
          body.label || null,
          walletType === 'connected', // Connected wallets with signature are verified
          isPrimary,
          cachedBalance,
          cachedPoints,
          cachedTier,
          cachedCredits
        ]
      );

      res.status(201).json({
        id: result.rows[0].id,
        address: body.address,
        type: walletType,
        isPrimary,
        balance: {
          umtc: cachedBalance,
          mtc: cachedBalance / 1_000_000
        },
        loyalty: {
          points: cachedPoints,
          tier: cachedTier
        },
        aiCredits: cachedCredits
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // DELETE /api/blockchain/wallets/:id - Disconnect wallet
  // -------------------------------------------------------------------------
  router.delete('/wallets/:id', async (req, res, next) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const { id } = req.params;

      const result = await pool.query(
        `UPDATE wallet_addresses 
         SET deleted_at = NOW() 
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
         RETURNING address`,
        [id, tenantId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      res.json({ success: true, address: result.rows[0].address });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/blockchain/loyalty/:address - Get loyalty account
  // -------------------------------------------------------------------------
  router.get('/loyalty/:address', async (req, res, next) => {
    try {
      const { address } = req.params;
      const client = getMTCClient();

      if (!await client.isConnected()) {
        return res.status(503).json({ error: 'Blockchain not connected' });
      }

      const account = await client.getLoyaltyAccount(address);
      
      if (!account) {
        return res.json({
          address,
          points: 0,
          tier: 'bronze',
          tierConfig: getTierConfig('bronze'),
          lifetimePoints: 0
        });
      }

      res.json({
        address,
        points: Number(account.points),
        tier: account.tier,
        tierConfig: getTierConfig(account.tier),
        lifetimePoints: Number(account.lifetimePoints),
        multiplier: account.multiplier
      });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/blockchain/loyalty/earn - Earn loyalty points
  // -------------------------------------------------------------------------
  router.post('/loyalty/earn', async (req, res, next) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const body = earnPointsSchema.parse(req.body);

      const client = getMTCClient();
      
      if (!client.isConnected()) {
        return res.status(503).json({ error: 'Blockchain not connected' });
      }

      const result = await client.earnPoints({
        address: body.walletAddress,
        action: body.action as LoyaltyAction,
        amount: body.amount,
        metadata: body.metadata
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Get updated account info
      const account = await client.getLoyaltyAccount(body.walletAddress);
      const tier = account?.tier || 'bronze';
      const points = account ? Number(account.points) : 0;

      // Update cached values in DB
      await pool.query(
        `UPDATE wallet_addresses 
         SET cached_loyalty_points = $1, 
             cached_loyalty_tier = $2,
             cache_updated_at = NOW()
         WHERE tenant_id = $3 AND address = $4`,
        [points, tier, tenantId, body.walletAddress]
      );

      // Calculate points earned based on action
      const pointsEarned = body.action === 'purchase' && body.amount
        ? Math.floor(body.amount * 10 * (account?.multiplier || 1))
        : (DEFAULT_REWARD_RULES.find(r => r.action === body.action)?.basePoints || 0);

      res.json({
        success: true,
        pointsEarned,
        newBalance: points,
        tier,
        txHash: result.txHash
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/blockchain/loyalty/redeem - Redeem points
  // -------------------------------------------------------------------------
  router.post('/loyalty/redeem', async (req, res, next) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const body = redeemPointsSchema.parse(req.body);

      const client = getMTCClient();
      
      if (!client.isConnected()) {
        return res.status(503).json({ error: 'Blockchain not connected' });
      }

      const result = await client.redeemPoints({
        address: body.walletAddress,
        points: BigInt(body.points),
        rewardType: body.rewardType,
        metadata: body.metadata
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Get updated account info
      const account = await client.getLoyaltyAccount(body.walletAddress);
      const tier = account?.tier || 'bronze';
      const points = account ? Number(account.points) : 0;

      // Update cached values
      await pool.query(
        `UPDATE wallet_addresses 
         SET cached_loyalty_points = $1,
             cached_loyalty_tier = $2,
             cache_updated_at = NOW()
         WHERE tenant_id = $3 AND address = $4`,
        [points, tier, tenantId, body.walletAddress]
      );

      res.json({
        success: true,
        pointsRedeemed: body.points,
        newBalance: points,
        tier,
        reward: body.rewardType,
        txHash: result.txHash
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/blockchain/loyalty/leaderboard - Loyalty leaderboard
  // -------------------------------------------------------------------------
  router.get('/loyalty/leaderboard', async (req, res, next) => {
    try {
      const client = getMTCClient();
      
      if (!client.isConnected()) {
        return res.status(503).json({ error: 'Blockchain not connected' });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const leaderboard = await client.getLeaderboard(limit);

      res.json({
        leaderboard: leaderboard.map((entry, index) => ({
          rank: index + 1,
          address: entry.address,
          points: Number(entry.points),
          tier: entry.tier
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/blockchain/credits/:address - Get AI credits balance
  // -------------------------------------------------------------------------
  router.get('/credits/:address', async (req, res, next) => {
    try {
      const { address } = req.params;
      const client = getMTCClient();

      if (!client.isConnected()) {
        return res.status(503).json({ error: 'Blockchain not connected' });
      }

      const balance = await client.getCreditBalance(address);

      res.json({
        address,
        credits: balance?.availableCredits || 0,
        lifetimeCredits: balance?.totalCredits || 0
      });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/blockchain/credits/packages - Available credit packages
  // -------------------------------------------------------------------------
  router.get('/credits/packages', async (req, res, next) => {
    try {
      res.json({
        packages: CREDIT_PACKAGES.map(pkg => ({
          id: pkg.package,
          credits: pkg.credits,
          bonusCredits: pkg.bonusCredits,
          totalCredits: pkg.credits + pkg.bonusCredits,
          priceUMTC: Number(pkg.priceUMTC),
          priceMTC: Number(pkg.priceUMTC) / 1_000_000,
          description: pkg.description
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/blockchain/credits/purchase - Purchase credits
  // -------------------------------------------------------------------------
  router.post('/credits/purchase', async (req, res, next) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const body = purchaseCreditsSchema.parse(req.body);

      const client = getMTCClient();
      
      if (!client.isConnected()) {
        return res.status(503).json({ error: 'Blockchain not connected' });
      }

      const result = await client.purchaseCredits({
        address: body.walletAddress,
        package: body.package as CreditPackage
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error || 'Purchase failed' });
      }

      // Get updated balance
      const balance = await client.getCreditBalance(body.walletAddress);
      const newBalance = balance?.availableCredits || 0;

      // Update cached credits
      await pool.query(
        `UPDATE wallet_addresses 
         SET cached_ai_credits = $1,
             cache_updated_at = NOW()
         WHERE tenant_id = $2 AND address = $3`,
        [newBalance, tenantId, body.walletAddress]
      );

      // Get package info for credits purchased
      const packageInfo = CREDIT_PACKAGES.find(p => p.package === body.package);
      const creditsPurchased = packageInfo 
        ? packageInfo.credits + packageInfo.bonusCredits 
        : 0;

      res.json({
        success: true,
        creditsPurchased,
        newBalance,
        txHash: result.txHash
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/blockchain/credits/use - Use credits for AI service
  // -------------------------------------------------------------------------
  router.post('/credits/use', async (req, res, next) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const body = useCreditsSchema.parse(req.body);

      const client = getMTCClient();
      
      if (!client.isConnected()) {
        return res.status(503).json({ error: 'Blockchain not connected' });
      }

      const result = await client.useCredits({
        address: body.walletAddress,
        service: body.service as AIService,
        amount: body.units
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error || 'Insufficient credits' });
      }

      // Get updated balance
      const balance = await client.getCreditBalance(body.walletAddress);
      const newBalance = balance?.availableCredits || 0;

      // Update cached credits
      await pool.query(
        `UPDATE wallet_addresses 
         SET cached_ai_credits = $1,
             cache_updated_at = NOW()
         WHERE tenant_id = $2 AND address = $3`,
        [newBalance, tenantId, body.walletAddress]
      );

      // Calculate credits used from service pricing
      const pricing = getServicePricing(body.service as AIService);
      const creditsUsed = pricing ? pricing.creditsPerCall * (body.units || 1) : 0;

      res.json({
        success: true,
        creditsUsed,
        newBalance,
        service: body.service
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/blockchain/credits/pricing - AI service pricing
  // -------------------------------------------------------------------------
  router.get('/credits/pricing', async (req, res, next) => {
    try {
      res.json({
        services: AI_SERVICE_PRICING.map(svc => ({
          service: svc.service,
          creditsPerCall: svc.creditsPerCall,
          description: svc.description
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/blockchain/sync/:address - Sync wallet data from chain
  // -------------------------------------------------------------------------
  router.post('/sync/:address', async (req, res, next) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const { address } = req.params;

      const client = getMTCClient();
      
      if (!client.isConnected()) {
        return res.status(503).json({ error: 'Blockchain not connected' });
      }

      // Fetch all data from chain
      const [walletInfo, loyaltyAccount, creditBalance] = await Promise.all([
        client.getWalletInfo(address),
        client.getLoyaltyAccount(address),
        client.getCreditBalance(address)
      ]);

      const balance = walletInfo?.balance ? Number(walletInfo.balance) : 0;
      const points = loyaltyAccount ? Number(loyaltyAccount.points) : 0;
      const tier = loyaltyAccount?.tier || 'bronze';
      const credits = creditBalance?.availableCredits || 0;

      // Update cache
      await pool.query(
        `UPDATE wallet_addresses 
         SET cached_balance_umtc = $1,
             cached_loyalty_points = $2,
             cached_loyalty_tier = $3,
             cached_ai_credits = $4,
             cache_updated_at = NOW()
         WHERE tenant_id = $5 AND address = $6 AND deleted_at IS NULL`,
        [balance, points, tier, credits, tenantId, address]
      );

      res.json({
        address,
        synced: true,
        balance: {
          umtc: balance,
          mtc: balance / 1_000_000
        },
        loyalty: {
          points,
          tier
        },
        aiCredits: credits,
        syncedAt: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
