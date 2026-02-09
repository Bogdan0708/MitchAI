import { Pool } from 'pg';
import Stripe from 'stripe';
import { BillingService } from '../../services/tenant/billing.service';

// Mock pg
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    subscriptions: {
      list: jest.fn(),
    },
    customers: {
      create: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
    billingPortal: {
      sessions: {
        create: jest.fn(),
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

describe.skip('BillingService', () => {
  let pool: Pool;
  let billingService: BillingService;
  let mockStripe: any;

  const mockTenant = {
    id: 'tenant-123',
    name: 'Test Business',
    email: 'test@example.com',
    status: 'active',
    stripe_customer_id: 'cus_test123',
    api_calls_this_month: 500,
    tier_name: 'professional',
    tier_display_name: 'Professional',
    price_monthly: '149.00',
    max_api_calls_monthly: 50000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    pool = new Pool();
    billingService = new BillingService(pool, 'sk_test_mock');
    mockStripe = (Stripe as jest.MockedClass<typeof Stripe>).mock.results[0].value;
  });

  describe('getBillingInfo', () => {
    it('should return billing info for tenant with active subscription', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockTenant] });

      mockStripe.subscriptions.list.mockResolvedValue({
        data: [{
          id: 'sub_test123',
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          cancel_at_period_end: false,
        }],
      });

      const result = await billingService.getBillingInfo('tenant-123');

      expect(result).toMatchObject({
        tenantId: 'tenant-123',
        tier: 'professional',
        tierDisplayName: 'Professional',
        priceMonthly: 149.00,
        stripeCustomerId: 'cus_test123',
        stripeSubscriptionId: 'sub_test123',
      });
      expect(result.usage.apiCallsThisMonth).toBe(500);
      expect(result.usage.apiCallsLimit).toBe(50000);
      expect(result.usage.percentUsed).toBe(1); // 500/50000 = 1%
    });

    it('should throw error when tenant not found', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(billingService.getBillingInfo('nonexistent')).rejects.toThrow('Tenant not found');
    });

    it('should handle tenant without Stripe customer', async () => {
      const tenantWithoutStripe = {
        ...mockTenant,
        stripe_customer_id: null,
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [tenantWithoutStripe] });

      const result = await billingService.getBillingInfo('tenant-123');

      expect(result.stripeCustomerId).toBeNull();
      expect(result.stripeSubscriptionId).toBeNull();
      expect(mockStripe.subscriptions.list).not.toHaveBeenCalled();
    });

    it('should handle Stripe API errors gracefully', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockTenant] });

      mockStripe.subscriptions.list.mockRejectedValue(new Error('Stripe API error'));

      // Should not throw, just return with default subscription details
      const result = await billingService.getBillingInfo('tenant-123');

      expect(result.tenantId).toBe('tenant-123');
      expect(result.status).toBe('active'); // Falls back to tenant status
    });
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session for existing customer', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'tenant-123', email: 'test@example.com', stripe_customer_id: 'cus_test123' }],
      });

      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/session/cs_test123',
      });

      const result = await billingService.createCheckoutSession(
        'tenant-123',
        'professional',
        'monthly',
        'https://app.example.com/success',
        'https://app.example.com/cancel'
      );

      expect(result).toEqual({
        sessionId: 'cs_test123',
        url: 'https://checkout.stripe.com/session/cs_test123',
      });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_test123',
          mode: 'subscription',
          metadata: { tenantId: 'tenant-123', tier: 'professional' },
        })
      );
    });

    it('should create new customer if none exists', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ id: 'tenant-123', email: 'test@example.com', stripe_customer_id: null }],
        })
        .mockResolvedValueOnce({}); // Update query

      mockStripe.customers.create.mockResolvedValue({ id: 'cus_new123' });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/session/cs_test123',
      });

      await billingService.createCheckoutSession(
        'tenant-123',
        'starter',
        'monthly',
        'https://app.example.com/success',
        'https://app.example.com/cancel'
      );

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        metadata: { tenantId: 'tenant-123' },
      });

      // Should save customer ID
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('should throw error when tenant not found', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        billingService.createCheckoutSession(
          'nonexistent',
          'starter',
          'monthly',
          'https://app.example.com/success',
          'https://app.example.com/cancel'
        )
      ).rejects.toThrow('Tenant not found');
    });
  });

  describe('createPortalSession', () => {
    it('should create customer portal session', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ stripe_customer_id: 'cus_test123' }],
      });

      mockStripe.billingPortal.sessions.create.mockResolvedValue({
        url: 'https://billing.stripe.com/portal/session_test',
      });

      const result = await billingService.createPortalSession(
        'tenant-123',
        'https://app.example.com/settings'
      );

      expect(result).toEqual({
        url: 'https://billing.stripe.com/portal/session_test',
      });

      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_test123',
        return_url: 'https://app.example.com/settings',
      });
    });

    it('should throw error when no Stripe customer exists', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ stripe_customer_id: null }],
      });

      await expect(
        billingService.createPortalSession('tenant-123', 'https://app.example.com/settings')
      ).rejects.toThrow('No Stripe customer found for this tenant');
    });

    it('should throw error when tenant not found', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        billingService.createPortalSession('nonexistent', 'https://app.example.com/settings')
      ).rejects.toThrow('No Stripe customer found for this tenant');
    });
  });

  describe('handleWebhook', () => {
    it('should handle checkout.session.completed event', async () => {
      const event = {
        id: 'evt_test123',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { tenantId: 'tenant-123', tier: 'professional' },
          },
        },
      } as unknown as Stripe.Event;

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Get tier ID
        .mockResolvedValueOnce({}); // Update tenant

      await billingService.handleWebhook(event);

      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('should handle customer.subscription.updated event', async () => {
      const event = {
        id: 'evt_test123',
        type: 'customer.subscription.updated',
        data: {
          object: {
            metadata: { tenantId: 'tenant-123' },
            status: 'active',
          },
        },
      } as unknown as Stripe.Event;

      (pool.query as jest.Mock).mockResolvedValueOnce({});

      await billingService.handleWebhook(event);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tenants'),
        ['active', 'tenant-123']
      );
    });

    it('should handle customer.subscription.deleted event', async () => {
      const event = {
        id: 'evt_test123',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            metadata: { tenantId: 'tenant-123' },
          },
        },
      } as unknown as Stripe.Event;

      (pool.query as jest.Mock).mockResolvedValueOnce({});

      await billingService.handleWebhook(event);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('canceled'),
        ['tenant-123']
      );
    });

    it('should handle invoice.payment_succeeded event', async () => {
      const event = {
        id: 'evt_test123',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            customer: 'cus_test123',
          },
        },
      } as unknown as Stripe.Event;

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'tenant-123' }] }) // Find tenant
        .mockResolvedValueOnce({}); // Reset API calls

      await billingService.handleWebhook(event);

      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('api_calls_this_month = 0'),
        ['tenant-123']
      );
    });

    it('should handle invoice.payment_failed event', async () => {
      const event = {
        id: 'evt_test123',
        type: 'invoice.payment_failed',
        data: {
          object: {
            customer: 'cus_test123',
          },
        },
      } as unknown as Stripe.Event;

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'tenant-123' }] })
        .mockResolvedValueOnce({});

      await billingService.handleWebhook(event);

      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('past_due'),
        ['tenant-123']
      );
    });

    it('should handle unrecognized event types gracefully', async () => {
      const event = {
        id: 'evt_test123',
        type: 'some.unknown.event',
        data: { object: {} },
      } as unknown as Stripe.Event;

      // Should not throw
      await billingService.handleWebhook(event);

      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify webhook signature', () => {
      const mockEvent = { id: 'evt_test123' } as Stripe.Event;
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = billingService.verifyWebhookSignature(
        'payload',
        'signature',
        'whsec_test'
      );

      expect(result).toEqual(mockEvent);
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'payload',
        'signature',
        'whsec_test'
      );
    });
  });

  describe('getPricingTiers', () => {
    it('should return all pricing tiers', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            name: 'starter',
            display_name: 'Starter',
            price_monthly: '49.00',
            max_locations: 1,
            max_users: 5,
            max_menu_items: 100,
            max_api_calls_monthly: 10000,
            features: { menu_ai: true },
          },
          {
            name: 'professional',
            display_name: 'Professional',
            price_monthly: '149.00',
            max_locations: 5,
            max_users: 20,
            max_menu_items: 500,
            max_api_calls_monthly: 50000,
            features: { menu_ai: true, social_media: true },
          },
          {
            name: 'enterprise',
            display_name: 'Enterprise',
            price_monthly: '499.00',
            max_locations: -1,
            max_users: -1,
            max_menu_items: -1,
            max_api_calls_monthly: 500000,
            features: { menu_ai: true, social_media: true, voice_ai: true },
          },
        ],
      });

      const result = await billingService.getPricingTiers();

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        name: 'starter',
        displayName: 'Starter',
        priceMonthly: 49.00,
        priceYearly: 490.00, // 10 months
        limits: {
          locations: 1,
          users: 5,
          menuItems: 100,
          apiCalls: 10000,
        },
      });

      // Enterprise should have Infinity for unlimited
      expect(result[2].limits.locations).toBe(Infinity);
      expect(result[2].limits.users).toBe(Infinity);
    });
  });
});
