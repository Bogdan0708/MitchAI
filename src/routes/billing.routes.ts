/**
 * Billing Routes
 * Handles Stripe checkout, portal, and subscription management
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { StripeService } from '../services/billing/stripe.service';
import { apiResponse } from '../utils/response.utils';

export function createBillingRoutes(pool: Pool): Router {
  const router = Router();
  const stripeService = new StripeService(pool);

  /**
   * POST /billing/checkout
   * Create a checkout session for subscription
   */
  router.post('/checkout', async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenant?.tenantId;
      if (!tenantId) {
        return apiResponse.unauthorized(res, 'Authentication required');
      }

      const { tier } = req.body;
      if (!tier || !['starter', 'professional', 'enterprise'].includes(tier.toLowerCase())) {
        return apiResponse.badRequest(res, 'Invalid tier. Must be starter, professional, or enterprise');
      }

      const baseUrl = process.env.FRONTEND_URL || 'https://mitchfromtransylvania.com';
      const successUrl = `${baseUrl}/dashboard/settings/billing`;
      const cancelUrl = `${baseUrl}/pricing`;

      const session = await stripeService.createCheckoutSession(
        tenantId,
        tier.toLowerCase(),
        successUrl,
        cancelUrl
      );

      return apiResponse.success(res, session);
    } catch (error: any) {
      console.error('Create checkout session error:', error);
      return apiResponse.serverError(res, error.message || 'Failed to create checkout session');
    }
  });

  /**
   * POST /billing/portal
   * Create a customer portal session for managing subscription
   */
  router.post('/portal', async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenant?.tenantId;
      if (!tenantId) {
        return apiResponse.unauthorized(res, 'Authentication required');
      }

      const baseUrl = process.env.FRONTEND_URL || 'https://mitchfromtransylvania.com';
      const returnUrl = `${baseUrl}/dashboard/settings/billing`;

      const url = await stripeService.createPortalSession(tenantId, returnUrl);

      return apiResponse.success(res, { url });
    } catch (error: any) {
      console.error('Create portal session error:', error);
      return apiResponse.serverError(res, error.message || 'Failed to create portal session');
    }
  });

  /**
   * GET /billing/subscription
   * Get current subscription status
   */
  router.get('/subscription', async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenant?.tenantId;
      if (!tenantId) {
        return apiResponse.unauthorized(res, 'Authentication required');
      }

      const subscription = await stripeService.getSubscriptionStatus(tenantId);

      return apiResponse.success(res, subscription);
    } catch (error: any) {
      console.error('Get subscription error:', error);
      return apiResponse.serverError(res, error.message || 'Failed to get subscription');
    }
  });

  return router;
}

/**
 * Webhook Routes (separate, no auth required)
 */
export function createWebhookRoutes(pool: Pool): Router {
  const router = Router();
  const stripeService = new StripeService(pool);

  /**
   * POST /webhooks/stripe
   * Handle Stripe webhook events
   */
  router.post('/stripe', async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      console.error('No Stripe signature header');
      return res.status(400).json({ error: 'No signature' });
    }

    try {
      // req.body should be raw buffer for webhook verification
      const result = await stripeService.handleWebhook(req.body, signature);
      return res.json(result);
    } catch (error: any) {
      console.error('Webhook error:', error);
      return res.status(400).json({ error: error.message });
    }
  });

  return router;
}
