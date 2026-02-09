/**
 * Stripe Billing Service
 * Handles subscriptions, checkout sessions, and webhook events
 */

import Stripe from 'stripe';
import { Pool } from 'pg';

// Price IDs from Stripe
const PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER || 'price_1SytrfLwJisplivCtM3o0kdU',
  professional: process.env.STRIPE_PRICE_PROFESSIONAL || 'price_1SytxkLwJisplivCSiqx9VJ0',
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || 'price_1Syu6WLwJisplivCnnWOYBDw',
};

// Tier mapping
const TIER_TO_PRICE: Record<string, string> = {
  starter: PRICE_IDS.starter,
  professional: PRICE_IDS.professional,
  enterprise: PRICE_IDS.enterprise,
};

const PRICE_TO_TIER: Record<string, string> = {
  [PRICE_IDS.starter]: 'starter',
  [PRICE_IDS.professional]: 'professional',
  [PRICE_IDS.enterprise]: 'enterprise',
};

export class StripeService {
  private stripe: Stripe;
  private pool: Pool;
  private webhookSecret: string;

  constructor(pool: Pool) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      console.warn('⚠️ STRIPE_SECRET_KEY not set - billing features disabled');
    }
    
    this.stripe = new Stripe(secretKey || '', {
      apiVersion: '2024-12-18.acacia',
    });
    
    this.pool = pool;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  }

  /**
   * Create a Stripe customer for a tenant
   */
  async createCustomer(tenantId: string, email: string, name: string): Promise<string> {
    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata: {
        tenantId,
      },
    });

    // Store customer ID in database
    await this.pool.query(
      `UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2`,
      [customer.id, tenantId]
    );

    return customer.id;
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(
    tenantId: string,
    tier: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ sessionId: string; url: string }> {
    const priceId = TIER_TO_PRICE[tier.toLowerCase()];
    if (!priceId) {
      throw new Error(`Invalid tier: ${tier}`);
    }

    // Get or create Stripe customer
    const tenantResult = await this.pool.query(
      `SELECT t.id, t.name, t.stripe_customer_id, u.email 
       FROM tenants t 
       JOIN users u ON u.tenant_id = t.id AND u.role = 'admin'
       WHERE t.id = $1 
       LIMIT 1`,
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      throw new Error('Tenant not found');
    }

    const tenant = tenantResult.rows[0];
    let customerId = tenant.stripe_customer_id;

    if (!customerId) {
      customerId = await this.createCustomer(tenantId, tenant.email, tenant.name);
    }

    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        tenantId,
        tier,
      },
      subscription_data: {
        metadata: {
          tenantId,
          tier,
        },
      },
    });

    return {
      sessionId: session.id,
      url: session.url!,
    };
  }

  /**
   * Create a customer portal session for managing subscription
   */
  async createPortalSession(tenantId: string, returnUrl: string): Promise<string> {
    const tenantResult = await this.pool.query(
      `SELECT stripe_customer_id FROM tenants WHERE id = $1`,
      [tenantId]
    );

    const customerId = tenantResult.rows[0]?.stripe_customer_id;
    if (!customerId) {
      throw new Error('No Stripe customer found for tenant');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session.url;
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(payload: Buffer, signature: string): Promise<{ received: boolean; event?: string }> {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    console.log(`📨 Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true, event: event.type };
  }

  /**
   * Handle checkout.session.completed
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const tenantId = session.metadata?.tenantId;
    const tier = session.metadata?.tier;

    if (!tenantId || !tier) {
      console.error('Missing metadata in checkout session');
      return;
    }

    console.log(`✅ Checkout completed for tenant ${tenantId}, tier: ${tier}`);

    // Update tenant subscription status
    await this.pool.query(
      `UPDATE tenants 
       SET stripe_subscription_id = $1,
           subscription_status = 'active',
           tier_id = (SELECT id FROM pricing_tiers WHERE name = $2)
       WHERE id = $3`,
      [session.subscription, tier, tenantId]
    );
  }

  /**
   * Handle invoice.paid
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = invoice.subscription as string;
    
    if (!subscriptionId) return;

    console.log(`💰 Invoice paid for subscription ${subscriptionId}`);

    await this.pool.query(
      `UPDATE tenants 
       SET subscription_status = 'active',
           last_payment_at = NOW()
       WHERE stripe_subscription_id = $1`,
      [subscriptionId]
    );
  }

  /**
   * Handle invoice.payment_failed
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = invoice.subscription as string;
    
    if (!subscriptionId) return;

    console.log(`❌ Invoice payment failed for subscription ${subscriptionId}`);

    await this.pool.query(
      `UPDATE tenants 
       SET subscription_status = 'past_due'
       WHERE stripe_subscription_id = $1`,
      [subscriptionId]
    );

    // TODO: Send notification email to tenant admin
  }

  /**
   * Handle subscription updated
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata?.tenantId;
    const priceId = subscription.items.data[0]?.price?.id;
    const tier = priceId ? PRICE_TO_TIER[priceId] : null;

    console.log(`🔄 Subscription updated: ${subscription.id}, status: ${subscription.status}`);

    // Map Stripe status to our status
    let status = 'active';
    switch (subscription.status) {
      case 'active':
        status = 'active';
        break;
      case 'past_due':
        status = 'past_due';
        break;
      case 'canceled':
      case 'unpaid':
        status = 'canceled';
        break;
      case 'trialing':
        status = 'trialing';
        break;
      default:
        status = subscription.status;
    }

    if (tenantId) {
      await this.pool.query(
        `UPDATE tenants 
         SET subscription_status = $1,
             stripe_subscription_id = $2
             ${tier ? ', tier_id = (SELECT id FROM pricing_tiers WHERE name = $4)' : ''}
         WHERE id = $3`,
        tier ? [status, subscription.id, tenantId, tier] : [status, subscription.id, tenantId]
      );
    } else {
      // Try to find tenant by subscription ID
      await this.pool.query(
        `UPDATE tenants SET subscription_status = $1 WHERE stripe_subscription_id = $2`,
        [status, subscription.id]
      );
    }
  }

  /**
   * Handle subscription deleted/canceled
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    console.log(`🚫 Subscription canceled: ${subscription.id}`);

    await this.pool.query(
      `UPDATE tenants 
       SET subscription_status = 'canceled'
       WHERE stripe_subscription_id = $1`,
      [subscription.id]
    );
  }

  /**
   * Get subscription status for a tenant
   */
  async getSubscriptionStatus(tenantId: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT t.subscription_status, t.stripe_subscription_id, t.stripe_customer_id,
              pt.name as tier, pt.monthly_credits
       FROM tenants t
       LEFT JOIN pricing_tiers pt ON t.tier_id = pt.id
       WHERE t.id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const tenant = result.rows[0];

    // If we have a subscription, get details from Stripe
    if (tenant.stripe_subscription_id) {
      try {
        const subscription = await this.stripe.subscriptions.retrieve(tenant.stripe_subscription_id);
        return {
          status: tenant.subscription_status,
          tier: tenant.tier,
          credits: tenant.monthly_credits,
          stripeStatus: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        };
      } catch (err) {
        console.error('Error fetching Stripe subscription:', err);
      }
    }

    return {
      status: tenant.subscription_status || 'none',
      tier: tenant.tier,
      credits: tenant.monthly_credits,
    };
  }
}
