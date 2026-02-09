/**
 * BILLING SERVICE
 *
 * Handles Stripe billing operations:
 * - Subscription management
 * - Checkout sessions
 * - Customer portal
 * - Usage tracking
 * - Webhook processing
 */

import { Pool } from 'pg';
import Stripe from 'stripe';

// ============================================================================
// TYPES
// ============================================================================

export interface BillingInfo {
  tenantId: string;
  tier: string;
  tierDisplayName: string;
  priceMonthly: number;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'suspended';
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  usage: {
    apiCallsThisMonth: number;
    apiCallsLimit: number;
    percentUsed: number;
  };
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
}

export interface PortalSession {
  url: string;
}

// ============================================================================
// STRIPE PRICE IDS (configured in Stripe Dashboard)
// ============================================================================

const STRIPE_PRICES: Record<string, { monthly: string; yearly: string }> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || 'price_starter_monthly',
    yearly: process.env.STRIPE_PRICE_STARTER_YEARLY || 'price_starter_yearly'
  },
  professional: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly',
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY || 'price_pro_yearly'
  },
  enterprise: {
    monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || 'price_enterprise_monthly',
    yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || 'price_enterprise_yearly'
  }
};

// ============================================================================
// BILLING SERVICE
// ============================================================================

export class BillingService {
  private pool: Pool;
  private stripe: Stripe;

  constructor(pool: Pool, stripeSecretKey: string) {
    this.pool = pool;
    this.stripe = new Stripe(stripeSecretKey);
  }

  /**
   * Get billing info for a tenant
   */
  async getBillingInfo(tenantId: string): Promise<BillingInfo> {
    const result = await this.pool.query(`
      SELECT
        t.id, t.name, t.status, t.stripe_customer_id, t.api_calls_this_month,
        pt.name as tier_name, pt.display_name as tier_display_name,
        pt.price_monthly, pt.max_api_calls_monthly
      FROM tenants t
      JOIN pricing_tiers pt ON t.tier_id = pt.id
      WHERE t.id = $1
    `, [tenantId]);

    if (result.rows.length === 0) {
      throw new Error('Tenant not found');
    }

    const tenant = result.rows[0];
    let subscriptionDetails: {
      status: string;
      currentPeriodEnd: Date | null;
      cancelAtPeriodEnd: boolean;
      subscriptionId: string | null;
    } = {
      status: tenant.status,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      subscriptionId: null
    };

    // Fetch subscription details from Stripe if customer exists
    if (tenant.stripe_customer_id) {
      try {
        const subscriptions = await this.stripe.subscriptions.list({
          customer: tenant.stripe_customer_id,
          limit: 1,
          status: 'all'
        });

        if (subscriptions.data.length > 0) {
          const sub = subscriptions.data[0] as any;
          subscriptionDetails = {
            status: sub.status,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            subscriptionId: sub.id
          };
        }
      } catch (error) {
        console.error('Failed to fetch Stripe subscription:', error);
      }
    }

    const apiCallsLimit = tenant.max_api_calls_monthly || 10000;
    const apiCallsUsed = tenant.api_calls_this_month || 0;

    return {
      tenantId: tenant.id,
      tier: tenant.tier_name,
      tierDisplayName: tenant.tier_display_name,
      priceMonthly: parseFloat(tenant.price_monthly),
      status: subscriptionDetails.status as BillingInfo['status'],
      stripeCustomerId: tenant.stripe_customer_id,
      stripeSubscriptionId: subscriptionDetails.subscriptionId,
      currentPeriodEnd: subscriptionDetails.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptionDetails.cancelAtPeriodEnd,
      usage: {
        apiCallsThisMonth: apiCallsUsed,
        apiCallsLimit: apiCallsLimit,
        percentUsed: Math.round((apiCallsUsed / apiCallsLimit) * 100)
      }
    };
  }

  /**
   * Create a Stripe checkout session for new subscription or upgrade
   */
  async createCheckoutSession(
    tenantId: string,
    tier: 'starter' | 'professional' | 'enterprise',
    interval: 'monthly' | 'yearly' = 'monthly',
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSession> {
    // Get tenant info
    const tenantResult = await this.pool.query(
      'SELECT id, email, stripe_customer_id FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      throw new Error('Tenant not found');
    }

    const tenant = tenantResult.rows[0];
    const priceId = STRIPE_PRICES[tier][interval];

    // Create or use existing customer
    let customerId = tenant.stripe_customer_id;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: tenant.email,
        metadata: { tenantId }
      });
      customerId = customer.id;

      // Save customer ID
      await this.pool.query(
        'UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, tenantId]
      );
    }

    // Create checkout session
    // Always collect payment method, even for trials
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        tenantId,
        tier
      },
      subscription_data: {
        metadata: {
          tenantId,
          tier
        },
        // 14-day free trial - card required upfront
        trial_period_days: 14
      },
      // Always collect payment method, even during trial
      payment_method_collection: 'always',
      allow_promotion_codes: true,
      billing_address_collection: 'auto'
    });

    return {
      sessionId: session.id,
      url: session.url!
    };
  }

  /**
   * Create customer portal session for managing subscription
   */
  async createPortalSession(tenantId: string, returnUrl: string): Promise<PortalSession> {
    const result = await this.pool.query(
      'SELECT stripe_customer_id FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (result.rows.length === 0 || !result.rows[0].stripe_customer_id) {
      throw new Error('No Stripe customer found for this tenant');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: result.rows[0].stripe_customer_id,
      return_url: returnUrl
    });

    return { url: session.url };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionCanceled(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${event.type}`);
    }
  }

  /**
   * Verify Stripe webhook signature
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  // ============================================================================
  // PRIVATE WEBHOOK HANDLERS
  // ============================================================================

  private async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
    const tenantId = session.metadata?.tenantId;
    const tier = session.metadata?.tier;

    if (!tenantId || !tier) {
      console.error('Missing metadata in checkout session');
      return;
    }

    // Get tier ID
    const tierResult = await this.pool.query(
      'SELECT id FROM pricing_tiers WHERE name = $1',
      [tier]
    );

    if (tierResult.rows.length === 0) {
      console.error(`Unknown tier: ${tier}`);
      return;
    }

    // Update tenant
    await this.pool.query(`
      UPDATE tenants
      SET tier_id = $1, status = 'active', updated_at = NOW()
      WHERE id = $2
    `, [tierResult.rows[0].id, tenantId]);

    console.log(`Tenant ${tenantId} upgraded to ${tier}`);
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata?.tenantId;
    if (!tenantId) return;

    const status = this.mapStripeStatus(subscription.status);

    await this.pool.query(`
      UPDATE tenants
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `, [status, tenantId]);
  }

  private async handleSubscriptionCanceled(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata?.tenantId;
    if (!tenantId) return;

    await this.pool.query(`
      UPDATE tenants
      SET status = 'canceled', updated_at = NOW()
      WHERE id = $1
    `, [tenantId]);
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    // Reset monthly API usage on successful payment
    const customerId = invoice.customer as string;

    const result = await this.pool.query(
      'SELECT id FROM tenants WHERE stripe_customer_id = $1',
      [customerId]
    );

    if (result.rows.length > 0) {
      await this.pool.query(`
        UPDATE tenants
        SET api_calls_this_month = 0, updated_at = NOW()
        WHERE id = $1
      `, [result.rows[0].id]);
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;

    const result = await this.pool.query(
      'SELECT id FROM tenants WHERE stripe_customer_id = $1',
      [customerId]
    );

    if (result.rows.length > 0) {
      await this.pool.query(`
        UPDATE tenants
        SET status = 'past_due', updated_at = NOW()
        WHERE id = $1
      `, [result.rows[0].id]);
    }
  }

  private mapStripeStatus(stripeStatus: string): string {
    const statusMap: Record<string, string> = {
      active: 'active',
      trialing: 'trialing',
      past_due: 'past_due',
      canceled: 'canceled',
      unpaid: 'suspended',
      incomplete: 'trialing',
      incomplete_expired: 'canceled'
    };
    return statusMap[stripeStatus] || 'active';
  }

  /**
   * Get available pricing tiers
   */
  async getPricingTiers(): Promise<Array<{
    name: string;
    displayName: string;
    priceMonthly: number;
    priceYearly: number;
    features: Record<string, boolean>;
    limits: {
      locations: number;
      users: number;
      menuItems: number;
      apiCalls: number;
    };
  }>> {
    const result = await this.pool.query(`
      SELECT
        name, display_name, price_monthly, max_locations, max_users,
        max_menu_items, max_api_calls_monthly, features
      FROM pricing_tiers
      ORDER BY price_monthly ASC
    `);

    return result.rows.map(row => ({
      name: row.name,
      displayName: row.display_name,
      priceMonthly: parseFloat(row.price_monthly),
      priceYearly: parseFloat(row.price_monthly) * 10, // 2 months free
      features: row.features || {},
      limits: {
        locations: row.max_locations === -1 ? Infinity : row.max_locations,
        users: row.max_users === -1 ? Infinity : row.max_users,
        menuItems: row.max_menu_items === -1 ? Infinity : row.max_menu_items,
        apiCalls: row.max_api_calls_monthly
      }
    }));
  }
}
