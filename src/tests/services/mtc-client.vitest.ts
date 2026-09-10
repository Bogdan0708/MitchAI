/**
 * MTC Client Tests
 * 
 * Tests for the Mitch Chain blockchain client
 */

import { describe, it, expect, beforeEach, jest as vi } from '@jest/globals';
import { MTCClient, getMTCClient, resetMTCClient } from '../../services/blockchain/mtc-client';
import {
  getTierForPoints,
  getTierConfig,
  calculatePurchasePoints,
  getServicePricing,
  uMTCtoMTC,
  MTCtouMTC,
  LOYALTY_TIERS,
  CREDIT_PACKAGES,
  AI_SERVICE_PRICING,
  DEFAULT_REWARD_RULES,
} from '../../services/blockchain/types';

// Mock fetch globally
const mockFetch = vi.fn() as jest.Mock;
global.fetch = mockFetch as unknown as typeof fetch;

describe('MTC Client', () => {
  let client: MTCClient;

  beforeEach(() => {
    resetMTCClient();
    client = new MTCClient({
      rpcUrl: 'http://localhost:26657',
      restUrl: 'http://localhost:1317',
      chainId: 'mitch-test-1',
      denom: 'uMTC',
      gasPrice: '0.025uMTC',
    });
    mockFetch.mockClear();
  });

  // ==========================================================================
  // CONNECTION TESTS
  // ==========================================================================

  describe('Connection', () => {
    it('should connect successfully when chain is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          default_node_info: { network: 'mitch-test-1' },
        }),
      });

      const connected = await client.connect();
      
      expect(connected).toBe(true);
      expect(client.isConnected()).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:1317/cosmos/base/tendermint/v1beta1/node_info'
      );
    });

    it('should handle connection failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const connected = await client.connect();
      
      expect(connected).toBe(false);
      expect(client.isConnected()).toBe(false);
    });

    it('should handle non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const connected = await client.connect();
      
      expect(connected).toBe(false);
    });
  });

  // ==========================================================================
  // WALLET OPERATIONS TESTS
  // ==========================================================================

  describe('Wallet Operations', () => {
    const testAddress = 'mitch1abc123def456ghi789jkl012mno345pqr678stu';

    it('should get wallet info with balance', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: [
            { denom: 'uMTC', amount: '1000000000' }, // 1000 MTC
          ],
        }),
      });

      const wallet = await client.getWalletInfo(testAddress);
      
      expect(wallet).not.toBeNull();
      expect(wallet?.address).toBe(testAddress);
      expect(wallet?.balance).toBe(1000000000n);
      expect(wallet?.balanceMTC).toBe(1000);
    });

    it('should return null for invalid address', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const wallet = await client.getWalletInfo('invalid');
      
      expect(wallet).toBeNull();
    });

    it('should handle wallet with zero balance', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balances: [] }),
      });

      const wallet = await client.getWalletInfo(testAddress);
      
      expect(wallet).not.toBeNull();
      expect(wallet?.balance).toBe(0n);
      expect(wallet?.balanceMTC).toBe(0);
    });
  });

  // ==========================================================================
  // LOYALTY OPERATIONS TESTS
  // ==========================================================================

  describe('Loyalty Operations', () => {
    const testAddress = 'mitch1abc123def456ghi789jkl012mno345pqr678stu';

    it('should get loyalty account with existing data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          loyalty_account: {
            points: '5500',
            lifetime_points: '10000',
          },
        }),
      });

      const account = await client.getLoyaltyAccount(testAddress);
      
      expect(account).not.toBeNull();
      expect(account?.address).toBe(testAddress);
      expect(account?.points).toBe(5500n);
      expect(account?.lifetimePoints).toBe(10000n);
      expect(account?.tier).toBe('gold'); // 10000 points = gold
      expect(account?.multiplier).toBe(1.5);
    });

    it('should return default account for new users', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const account = await client.getLoyaltyAccount(testAddress);
      
      expect(account).not.toBeNull();
      expect(account?.points).toBe(0n);
      expect(account?.tier).toBe('bronze');
      expect(account?.multiplier).toBe(1.0);
    });

    it('should earn points for purchase action', async () => {
      // Mock getLoyaltyAccount call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          loyalty_account: {
            points: '1000',
            lifetime_points: '1000',
          },
        }),
      });

      const result = await client.earnPoints({
        address: testAddress,
        action: 'purchase',
        amount: 50, // £50 purchase
      });
      
      expect(result.success).toBe(true);
      expect(result.txHash).toMatch(/^mock_tx_/);
    });

    it('should earn points for non-purchase actions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          loyalty_account: { points: '0', lifetime_points: '0' },
        }),
      });

      const result = await client.earnPoints({
        address: testAddress,
        action: 'review',
      });
      
      expect(result.success).toBe(true);
    });

    it('should redeem points successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          loyalty_account: {
            points: '1000',
            lifetime_points: '1000',
          },
        }),
      });

      const result = await client.redeemPoints({
        address: testAddress,
        points: 500n,
        rewardType: 'discount',
      });
      
      expect(result.success).toBe(true);
    });

    it('should fail redemption with insufficient points', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          loyalty_account: {
            points: '100',
            lifetime_points: '100',
          },
        }),
      });

      const result = await client.redeemPoints({
        address: testAddress,
        points: 500n,
        rewardType: 'discount',
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient points');
    });

    it('should get leaderboard', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: [
            { address: 'mitch1leader1...', display_name: 'Top User', points: '50000', lifetime_points: '50000' },
            { address: 'mitch1leader2...', display_name: 'Second', points: '30000', lifetime_points: '30000' },
          ],
        }),
      });

      const leaderboard = await client.getLeaderboard(10);
      
      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[0].tier).toBe('platinum');
      expect(leaderboard[1].rank).toBe(2);
    });

    it('should return empty leaderboard on error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const leaderboard = await client.getLeaderboard();
      
      expect(leaderboard).toEqual([]);
    });
  });

  // ==========================================================================
  // AI CREDITS TESTS
  // ==========================================================================

  describe('AI Credits Operations', () => {
    const testAddress = 'mitch1abc123def456ghi789jkl012mno345pqr678stu';

    it('should get credit balance', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          credit_account: {
            total_credits: '500',
            used_credits: '150',
            available_credits: '350',
          },
        }),
      });

      const balance = await client.getCreditBalance(testAddress);
      
      expect(balance).not.toBeNull();
      expect(balance?.totalCredits).toBe(500);
      expect(balance?.usedCredits).toBe(150);
      expect(balance?.availableCredits).toBe(350);
    });

    it('should return default balance for new users', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const balance = await client.getCreditBalance(testAddress);
      
      expect(balance).not.toBeNull();
      expect(balance?.totalCredits).toBe(0);
      expect(balance?.availableCredits).toBe(0);
    });

    it('should purchase credits with valid package', async () => {
      const result = await client.purchaseCredits({
        address: testAddress,
        package: 'professional',
      });
      
      expect(result.success).toBe(true);
      expect(result.txHash).toMatch(/^mock_tx_/);
    });

    it('should fail with invalid package', async () => {
      const result = await client.purchaseCredits({
        address: testAddress,
        package: 'invalid' as any,
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credit package');
    });

    it('should use credits successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          credit_account: {
            total_credits: '100',
            used_credits: '0',
            available_credits: '100',
          },
        }),
      });

      const result = await client.useCredits({
        address: testAddress,
        service: 'claude-sonnet',
      });
      
      expect(result.success).toBe(true);
    });

    it('should fail with insufficient credits', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          credit_account: {
            total_credits: '5',
            used_credits: '0',
            available_credits: '5',
          },
        }),
      });

      const result = await client.useCredits({
        address: testAddress,
        service: 'claude-opus', // 20 credits needed
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient credits');
    });

    it('should get credit history', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [
            {
              id: 'rec1',
              address: testAddress,
              service: 'gpt4',
              credits_used: '10',
              timestamp: '2025-01-28T12:00:00Z',
            },
          ],
        }),
      });

      const history = await client.getCreditHistory(testAddress);
      
      expect(history).toHaveLength(1);
      expect(history[0].service).toBe('gpt4');
      expect(history[0].creditsUsed).toBe(10);
    });
  });

  // ==========================================================================
  // SINGLETON TESTS
  // ==========================================================================

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const client1 = getMTCClient();
      const client2 = getMTCClient();
      
      expect(client1).toBe(client2);
    });

    it('should create new instance after reset', () => {
      const client1 = getMTCClient();
      resetMTCClient();
      const client2 = getMTCClient();
      
      expect(client1).not.toBe(client2);
    });
  });
});

// ==========================================================================
// UTILITY FUNCTION TESTS
// ==========================================================================

describe('MTC Utility Functions', () => {
  describe('uMTCtoMTC', () => {
    it('should convert uMTC to MTC correctly', () => {
      expect(uMTCtoMTC(1000000n)).toBe(1);
      expect(uMTCtoMTC(0n)).toBe(0);
      expect(uMTCtoMTC(500000n)).toBe(0.5);
      expect(uMTCtoMTC(1234567890n)).toBe(1234.56789);
    });
  });

  describe('MTCtouMTC', () => {
    it('should convert MTC to uMTC correctly', () => {
      expect(MTCtouMTC(1)).toBe(1000000n);
      expect(MTCtouMTC(0)).toBe(0n);
      expect(MTCtouMTC(0.5)).toBe(500000n);
      expect(MTCtouMTC(1234.567)).toBe(1234567000n);
    });
  });

  describe('getTierForPoints', () => {
    it('should return correct tier for point thresholds', () => {
      expect(getTierForPoints(0n)).toBe('bronze');
      expect(getTierForPoints(500n)).toBe('bronze');
      expect(getTierForPoints(1000n)).toBe('silver');
      expect(getTierForPoints(4999n)).toBe('silver');
      expect(getTierForPoints(5000n)).toBe('gold');
      expect(getTierForPoints(19999n)).toBe('gold');
      expect(getTierForPoints(20000n)).toBe('platinum');
      expect(getTierForPoints(100000n)).toBe('platinum');
    });
  });

  describe('getTierConfig', () => {
    it('should return correct config for each tier', () => {
      expect(getTierConfig('bronze').multiplier).toBe(1.0);
      expect(getTierConfig('silver').multiplier).toBe(1.25);
      expect(getTierConfig('gold').multiplier).toBe(1.5);
      expect(getTierConfig('platinum').multiplier).toBe(2.0);
    });

    it('should return bronze config for unknown tier', () => {
      expect(getTierConfig('unknown' as any)).toEqual(LOYALTY_TIERS[0]);
    });
  });

  describe('calculatePurchasePoints', () => {
    it('should calculate points with tier multiplier', () => {
      // Base: 10 points per £1
      expect(calculatePurchasePoints(10, 'bronze')).toBe(100);   // 10 * 10 * 1.0
      expect(calculatePurchasePoints(10, 'silver')).toBe(125);   // 10 * 10 * 1.25
      expect(calculatePurchasePoints(10, 'gold')).toBe(150);     // 10 * 10 * 1.5
      expect(calculatePurchasePoints(10, 'platinum')).toBe(200); // 10 * 10 * 2.0
    });

    it('should handle decimal amounts', () => {
      expect(calculatePurchasePoints(15.50, 'bronze')).toBe(155);
    });
  });

  describe('getServicePricing', () => {
    it('should return pricing for known services', () => {
      expect(getServicePricing('gpt4')?.creditsPerCall).toBe(10);
      expect(getServicePricing('claude-haiku')?.creditsPerCall).toBe(1);
      expect(getServicePricing('local-llm')?.creditsPerCall).toBe(0);
    });

    it('should return undefined for unknown service', () => {
      expect(getServicePricing('unknown' as any)).toBeUndefined();
    });
  });
});

// ==========================================================================
// CONSTANTS TESTS
// ==========================================================================

describe('MTC Constants', () => {
  describe('LOYALTY_TIERS', () => {
    it('should have 4 tiers in ascending order', () => {
      expect(LOYALTY_TIERS).toHaveLength(4);
      expect(LOYALTY_TIERS[0].tier).toBe('bronze');
      expect(LOYALTY_TIERS[3].tier).toBe('platinum');
      
      // Verify ascending point requirements
      for (let i = 1; i < LOYALTY_TIERS.length; i++) {
        expect(LOYALTY_TIERS[i].requiredPoints).toBeGreaterThan(
          LOYALTY_TIERS[i - 1].requiredPoints
        );
      }
    });

    it('should have increasing multipliers', () => {
      for (let i = 1; i < LOYALTY_TIERS.length; i++) {
        expect(LOYALTY_TIERS[i].multiplier).toBeGreaterThan(
          LOYALTY_TIERS[i - 1].multiplier
        );
      }
    });
  });

  describe('CREDIT_PACKAGES', () => {
    it('should have 3 packages', () => {
      expect(CREDIT_PACKAGES).toHaveLength(3);
    });

    it('should have increasing value', () => {
      for (let i = 1; i < CREDIT_PACKAGES.length; i++) {
        expect(CREDIT_PACKAGES[i].credits).toBeGreaterThan(
          CREDIT_PACKAGES[i - 1].credits
        );
      }
    });
  });

  describe('AI_SERVICE_PRICING', () => {
    it('should have pricing for all services', () => {
      expect(AI_SERVICE_PRICING.length).toBeGreaterThan(0);
      
      AI_SERVICE_PRICING.forEach(pricing => {
        expect(pricing.service).toBeDefined();
        expect(pricing.creditsPerCall).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have local-llm as free', () => {
      const localLLM = AI_SERVICE_PRICING.find(p => p.service === 'local-llm');
      expect(localLLM?.creditsPerCall).toBe(0);
    });
  });

  describe('DEFAULT_REWARD_RULES', () => {
    it('should have rules for common actions', () => {
      const actions = DEFAULT_REWARD_RULES.map(r => r.action);
      
      expect(actions).toContain('purchase');
      expect(actions).toContain('review');
      expect(actions).toContain('referral');
      expect(actions).toContain('signup');
    });

    it('should have positive base points', () => {
      DEFAULT_REWARD_RULES.forEach(rule => {
        expect(rule.basePoints).toBeGreaterThan(0);
      });
    });
  });
});
