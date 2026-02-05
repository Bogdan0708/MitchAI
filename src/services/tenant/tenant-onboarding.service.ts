/**
 * TENANT ONBOARDING SERVICE
 *
 * Handles complete tenant onboarding workflow including:
 * - Tenant creation
 * - Admin user setup
 * - Stripe customer creation
 * - Initial data seeding
 * - Welcome email
 */

import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcrypt';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { EmailService } from '../notifications/email.service';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface OnboardingRequest {
  // Business information
  businessName: string;
  slug: string;
  contactEmail: string;
  contactPhone?: string;

  // Admin user
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;

  // Subscription
  pricingTier: 'starter' | 'professional' | 'enterprise';
  paymentMethodId?: string; // Stripe payment method ID
  billingInterval?: 'monthly' | 'yearly';

  // Initial setup
  timezone?: string;
  locale?: string;

  // Optional first location
  firstLocation?: {
    name: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export interface OnboardingResult {
  success: boolean;
  tenantId: string;
  tenantSlug: string;
  adminUserId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  accessToken?: string;
  errors?: string[];
}

// ============================================================================
// TENANT ONBOARDING SERVICE
// ============================================================================

export class TenantOnboardingService {
  private pool: Pool;
  private stripe: Stripe | null;
  private stripeEnabled: boolean;
  private jwtSecret: string;
  private emailService: EmailService;

  constructor(pool: Pool, stripeSecretKey: string, jwtSecret: string) {
    this.pool = pool;
    // Only initialize Stripe if a real key is provided (not a placeholder)
    this.stripeEnabled = Boolean(stripeSecretKey && 
                         !stripeSecretKey.includes('placeholder') && 
                         stripeSecretKey.startsWith('sk_'));
    this.stripe = this.stripeEnabled 
      ? new Stripe(stripeSecretKey, { apiVersion: '2025-11-17.clover' })
      : null;
    this.jwtSecret = jwtSecret;
    this.emailService = new EmailService(pool);
    
    if (!this.stripeEnabled) {
      console.warn('[TenantOnboarding] Stripe disabled - using placeholder key');
    }
  }

  /**
   * Complete onboarding workflow with transaction rollback on failure
   */
  async onboard(request: OnboardingRequest): Promise<OnboardingResult> {
    const client = await this.pool.connect();
    let stripeCustomerId: string | undefined;
    let stripeSubscriptionId: string | undefined;

    try {
      // Start database transaction
      await client.query('BEGIN');

      // 1. Validate business slug availability
      await this.validateSlugAvailability(client, request.slug);

      // 2. Validate admin email availability
      await this.validateEmailAvailability(client, request.adminEmail);

      // 3. Get pricing configuration
      const pricingConfig = await this.getPricingConfig(client, request.pricingTier);

      // 4. Create Stripe customer (if Stripe is enabled)
      let subscription: Stripe.Subscription | undefined;
      if (this.stripeEnabled && this.stripe) {
        const stripeCustomer = await this.createStripeCustomer(request);
        stripeCustomerId = stripeCustomer.id;

        // 5. Create Stripe subscription (if payment method provided)
        if (request.paymentMethodId) {
          // Attach payment method to customer
          await this.stripe.paymentMethods.attach(request.paymentMethodId, {
            customer: stripeCustomerId
          });

          // Set as default payment method
          await this.stripe.customers.update(stripeCustomerId, {
          invoice_settings: {
            default_payment_method: request.paymentMethodId
          }
        });

        // Create subscription
        subscription = await this.createStripeSubscription(
          stripeCustomerId,
          request.pricingTier,
          request.billingInterval || 'monthly',
          pricingConfig
        );
        stripeSubscriptionId = subscription.id;
        }
      } // End Stripe-enabled block

      // 6. Create tenant in database
      const tenantId = await this.createTenant(client, {
        ...request,
        stripeCustomerId,
        stripeSubscriptionId,
        subscriptionStatus: subscription ? 'active' : 'trialing'
      });

      // 7. Create admin user
      const adminUserId = await this.createAdminUser(client, tenantId, request);

      // 8. Create initial location (if provided)
      if (request.firstLocation) {
        await this.createInitialLocation(client, tenantId, request.firstLocation);
      }

      // 9. Seed initial data (sample menu categories, etc.)
      await this.seedInitialData(client, tenantId);

      // 10. Create audit log entry
      await this.logOnboarding(client, tenantId, adminUserId);

      // Commit transaction
      await client.query('COMMIT');

      // 11. Send welcome email (asynchronous, outside transaction)
      this.sendWelcomeEmail(request).catch(err =>
        console.error('Failed to send welcome email:', err)
      );

      // 12. Generate access token
      const { generateToken } = await import('../../middleware/tenant.middleware');
      const accessToken = generateToken(
        {
          tenantId,
          tenantSlug: request.slug,
          userId: adminUserId,
          userRole: 'owner',
          email: request.adminEmail
        },
        this.jwtSecret
      );

      return {
        success: true,
        tenantId,
        tenantSlug: request.slug,
        adminUserId,
        stripeCustomerId,
        stripeSubscriptionId,
        accessToken
      };
    } catch (error) {
      // Rollback database transaction
      await client.query('ROLLBACK');

      // Cleanup Stripe resources if created
      if (stripeCustomerId) {
        await this.cleanupStripeResources(stripeCustomerId, stripeSubscriptionId);
      }

      console.error('Onboarding error:', error);

      return {
        success: false,
        tenantId: '',
        tenantSlug: request.slug,
        adminUserId: '',
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    } finally {
      client.release();
    }
  }

  /**
   * Validate that slug is available and properly formatted
   */
  private async validateSlugAvailability(client: PoolClient, slug: string): Promise<void> {
    // Check format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      throw new Error('Slug must contain only lowercase letters, numbers, and hyphens');
    }

    if (slug.length < 3 || slug.length > 63) {
      throw new Error('Slug must be between 3 and 63 characters');
    }

    // Check availability
    const result = await client.query(
      'SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL',
      [slug]
    );

    if (result.rows.length > 0) {
      throw new Error('Business URL is already taken');
    }
  }

  /**
   * Validate email is not already in use
   */
  private async validateEmailAvailability(client: PoolClient, email: string): Promise<void> {
    const result = await client.query(
      'SELECT id FROM tenant_users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );

    if (result.rows.length > 0) {
      throw new Error('Email address is already registered');
    }
  }

  /**
   * Get pricing configuration from database
   */
  private async getPricingConfig(
    client: PoolClient,
    tier: string
  ): Promise<any> {
    const result = await client.query(
      'SELECT *, name as tier FROM pricing_tiers WHERE name = $1',
      [tier]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid pricing tier');
    }

    return result.rows[0];
  }

  /**
   * Create Stripe customer
   */
  private async createStripeCustomer(request: OnboardingRequest): Promise<Stripe.Customer> {
    return await this.stripe!.customers.create({
      name: request.businessName,
      email: request.contactEmail,
      phone: request.contactPhone,
      metadata: {
        slug: request.slug,
        pricing_tier: request.pricingTier
      }
    });
  }

  /**
   * Create Stripe subscription
   */
  private async createStripeSubscription(
    customerId: string,
    tier: string,
    interval: 'monthly' | 'yearly',
    pricingConfig: any
  ): Promise<Stripe.Subscription> {
    // In production, use actual Stripe Price IDs
    // For this example, we'll create prices on the fly
    const priceAmount = interval === 'monthly'
      ? pricingConfig.price_monthly_cents
      : pricingConfig.price_yearly_cents;

    // Note: In production, you should have pre-created Price IDs in Stripe
    // This is a simplified example
    const price = await this.stripe!.prices.create({
      unit_amount: priceAmount,
      currency: 'usd',
      recurring: {
        interval: interval === 'monthly' ? 'month' : 'year'
      },
      product_data: {
        name: `${pricingConfig.name} Plan`,
        metadata: { tier }
      }
    });

    return await this.stripe!.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent']
    });
  }

  /**
   * Create tenant record in database
   */
  private async createTenant(
    client: PoolClient,
    data: any
  ): Promise<string> {
    const tenantId = uuidv4();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14-day trial

    // Map pricing tier name to tier_id
    const tierMap: Record<string, number> = { starter: 1, professional: 2, enterprise: 3 };
    const tierId = tierMap[data.pricingTier] || 1;

    const result = await client.query(
      `INSERT INTO tenants (
        id, slug, name, email, tier_id, status, stripe_customer_id, settings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        tenantId,
        data.slug,
        data.businessName,
        data.contactEmail,
        tierId,
        data.subscriptionStatus === 'active' ? 'active' : 'trial',
        data.stripeCustomerId || null,
        JSON.stringify({
          timezone: data.timezone || 'UTC',
          locale: data.locale || 'en-US',
          contactPhone: data.contactPhone || null
        })
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Create admin user for tenant
   */
  private async createAdminUser(
    client: PoolClient,
    tenantId: string,
    request: OnboardingRequest
  ): Promise<string> {
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(request.adminPassword, 10);

    const result = await client.query(
      `INSERT INTO tenant_users (
        id, tenant_id, email, password_hash,
        first_name, last_name, role, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        userId,
        tenantId,
        request.adminEmail,
        passwordHash,
        request.adminFirstName,
        request.adminLastName,
        'owner',
        true
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Create initial location
   */
  private async createInitialLocation(
    client: PoolClient,
    tenantId: string,
    location: any
  ): Promise<void> {
    const locationId = uuidv4();
    const slug = location.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    await client.query(
      `INSERT INTO locations (
        id, tenant_id, name, slug,
        address_line1, city, state, postal_code, country, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        locationId,
        tenantId,
        location.name,
        slug,
        location.address,
        location.city,
        location.state,
        location.postalCode,
        location.country,
        true
      ]
    );
  }

  /**
   * Seed initial data for new tenant
   */
  private async seedInitialData(client: PoolClient, tenantId: string): Promise<void> {
    // Create sample menu categories
    const categories = ['Appetizers', 'Main Courses', 'Desserts', 'Beverages'];

    for (let i = 0; i < categories.length; i++) {
      await client.query(
        `INSERT INTO menu_categories (id, tenant_id, name, display_order, is_active)
        VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), tenantId, categories[i], i, true]
      );
    }
  }

  /**
   * Log onboarding event
   */
  private async logOnboarding(
    client: PoolClient,
    tenantId: string,
    userId: string
  ): Promise<void> {
    await client.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tenantId,
        userId,
        'tenant.onboarded',
        'tenant',
        tenantId,
        JSON.stringify({ event: 'onboarding_completed' })
      ]
    );
  }

  /**
   * Send welcome email to new tenant
   */
  private async sendWelcomeEmail(request: OnboardingRequest): Promise<void> {
    try {
      await this.emailService.sendWelcome(
        request.contactEmail,
        request.adminFirstName,
        request.businessName
      );
      console.log(`Welcome email sent to ${request.contactEmail}`);
    } catch (error) {
      // Log error but don't fail onboarding - email is non-critical
      console.error(`Failed to send welcome email to ${request.contactEmail}:`, error);
    }
  }

  /**
   * Cleanup Stripe resources on failure
   */
  private async cleanupStripeResources(
    _customerId: string,
    subscriptionId?: string
  ): Promise<void> {
    if (!this.stripeEnabled || !this.stripe) return;
    try {
      if (subscriptionId) {
        await this.stripe.subscriptions.cancel(subscriptionId);
      }
      // Note: We don't delete customers to maintain audit trail
      // await this.stripe.customers.del(customerId);
    } catch (error) {
      console.error('Failed to cleanup Stripe resources:', error);
    }
  }

  /**
   * Check if tenant can be upgraded to a higher tier
   */
  async canUpgrade(tenantId: string, newTier: string): Promise<{ canUpgrade: boolean; reason?: string }> {
    const client = await this.pool.connect();
    try {
      // Check current tier
      const result = await client.query(
        'SELECT pricing_tier, subscription_status FROM tenants WHERE id = $1',
        [tenantId]
      );

      if (result.rows.length === 0) {
        return { canUpgrade: false, reason: 'Tenant not found' };
      }

      const tenant = result.rows[0];

      // Check subscription status
      if (tenant.subscription_status !== 'active' && tenant.subscription_status !== 'trialing') {
        return { canUpgrade: false, reason: 'Subscription is not active' };
      }

      // Check tier hierarchy
      const tierHierarchy = ['starter', 'professional', 'enterprise'];
      const currentIndex = tierHierarchy.indexOf(tenant.pricing_tier);
      const newIndex = tierHierarchy.indexOf(newTier);

      if (newIndex <= currentIndex) {
        return { canUpgrade: false, reason: 'Cannot downgrade or stay at same tier' };
      }

      return { canUpgrade: true };
    } finally {
      client.release();
    }
  }

  /**
   * Upgrade tenant to higher pricing tier
   */
  async upgradeTier(
    tenantId: string,
    newTier: 'professional' | 'enterprise',
    paymentMethodId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get tenant and pricing info
      const tenantResult = await client.query(
        'SELECT * FROM tenants WHERE id = $1',
        [tenantId]
      );

      if (tenantResult.rows.length === 0) {
        throw new Error('Tenant not found');
      }

      const tenant = tenantResult.rows[0];
      const pricingConfig = await this.getPricingConfig(client, newTier);

      // Update Stripe subscription (only if Stripe is enabled)
      if (this.stripeEnabled && this.stripe && tenant.stripe_subscription_id) {
        // Update existing subscription
        await this.stripe.subscriptions.update(tenant.stripe_subscription_id, {
          items: [{
            id: tenant.stripe_subscription_id,
            price: pricingConfig.stripe_price_id // You need to store this in pricing_tiers_config
          }],
          proration_behavior: 'always_invoice'
        });
      } else if (paymentMethodId) {
        // Create new subscription
        const subscription = await this.createStripeSubscription(
          tenant.stripe_customer_id,
          newTier,
          'monthly',
          pricingConfig
        );

        await client.query(
          'UPDATE tenants SET stripe_subscription_id = $1 WHERE id = $2',
          [subscription.id, tenantId]
        );
      }

      // Update tenant tier in database
      await client.query(
        `UPDATE tenants
        SET pricing_tier = $1,
            api_requests_limit = $2,
            status = 'active',
            subscription_status = 'active'
        WHERE id = $3`,
        [newTier, pricingConfig.api_requests_monthly, tenantId]
      );

      await client.query('COMMIT');

      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Upgrade error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upgrade failed'
      };
    } finally {
      client.release();
    }
  }
}

export default TenantOnboardingService;
