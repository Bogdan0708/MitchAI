/**
 * API ROUTES - Main Application Router
 *
 * Defines all API endpoints with tenant isolation and rate limiting
 */

import { Router, Request } from 'express';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { logger } from '../services/logger.service';

// Type for requests with tenant context
interface AuthenticatedRequest extends Request {
  tenant?: {
    tenantId: string;
    userId: string;
    userEmail: string;
    userRole: string;
    tier: {
      name: string;
      maxApiCalls: number;
      rateLimitPerMinute: number;
      features: Record<string, boolean>;
    };
  };
}
import { TenantMiddleware } from '../middleware/tenant.middleware';
import { RateLimitMiddleware } from '../middleware/rateLimit.middleware';
import { TenantController } from '../controllers/tenant.controller';
import { DataExportController } from '../controllers/data-export.controller';
import { LocationController } from '../controllers/location.controller';
import { MenuController } from '../controllers/menu.controller';
import { OrderController } from '../controllers/order.controller';
import { ReservationController } from '../controllers/reservation.controller';
import { validate } from '../middleware/validate.middleware';
import { loginSchema, registerSchema } from '../validators/auth.validator';
import { updateTenantSchema, createLocationSchema } from '../validators/tenant.validator';
import { createMenuItemSchema } from '../validators/menu.validator';
import { createOrderSchema } from '../validators/order.validator';
import { createReservationSchema } from '../validators/reservation.validator';
import { AuthService } from '../services/tenant/auth.service'; // Import AuthService
import {
  chatMessageSchema,
  menuEnhanceSchema,
  recommendationsSchema,
  reviewResponseSchema,
  createReviewSchema
} from '../validators/ai.validator';
import { TenantOnboardingService } from '../services/tenant/tenant-onboarding.service';
import { getAIRouter } from '../lib/ai-singleton';
import { ChatbotService } from '../services/tenant/chatbot.service';
import { MenuAIService } from '../services/tenant/menu-ai.service';
import { UpsellService } from '../services/tenant/upsell.service';
import { ReviewAIService } from '../services/tenant/review-ai.service';
import { BillingService } from '../services/tenant/billing.service';
import { EmailService } from '../services/notifications/email.service';
import { GoogleBusinessService } from '../services/integrations/google-business.service';
import { apiResponse } from '../lib/api-response';
import { v4 as uuidv4 } from 'uuid';

// Import modular route factories
import { createComplianceRouter } from './compliance.routes';
import { createReviewsRouter } from './reviews.routes';
import { createContentRouter } from './content.routes';
import { createIntelligenceRouter } from './intelligence.routes';
import { createAIRouter } from './ai.routes';

// Import multi-agent services
import { AgentService } from '../services/agents/agent.service';
import { ChatService } from '../services/agents/chat.service';
import { createAgentRouter } from '../services/agents/agent.router';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTimeAgo(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return past.toLocaleDateString();
}

// ============================================================================
// ROUTER CONFIGURATION
// ============================================================================

export function createApiRouter(pool: Pool, redis: Redis, jwtSecret: string): Router {
  const router = Router();

  // Initialize middleware
  const tenantMiddleware = new TenantMiddleware(pool, redis, jwtSecret);
  const rateLimitMiddleware = new RateLimitMiddleware(redis, pool);
  const tenantController = new TenantController(pool);
  const dataExportController = new DataExportController(pool);
  const locationController = new LocationController(pool);
  const menuController = new MenuController(pool);
  const orderController = new OrderController(pool);
  const reservationController = new ReservationController(pool);
  const authService = new AuthService(pool, jwtSecret); // Instantiate AuthService

  // ============================================================================
  // PUBLIC ROUTES (No authentication required)
  // ============================================================================

  // Health check
  router.get('/health', async (_req, res) => {
    try {
      // Check database connection
      await pool.query('SELECT 1');

      // Check Redis connection
      await redis.ping();

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'up',
          redis: 'up'
        }
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Onboarding endpoint (tenant signup)
  router.post('/onboard', validate(registerSchema), async (req, res) => {
    try {
      const onboardingService = new TenantOnboardingService(
        pool,
        process.env.STRIPE_SECRET_KEY!,
        jwtSecret
      );

      // Map API fields to service expected fields
      const onboardingRequest = {
        businessName: req.body.businessName,
        slug: req.body.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        contactEmail: req.body.email,
        adminFirstName: req.body.firstName,
        adminLastName: req.body.lastName,
        adminEmail: req.body.email,
        adminPassword: req.body.password,
        pricingTier: 'starter' as const,
        billingInterval: 'monthly' as const,
      };

      const result = await onboardingService.onboard(onboardingRequest);

      if (result.success) {
        res.status(201).json({
          success: true,
          data: {
            token: result.accessToken,
            user: {
              id: result.adminUserId,
              email: req.body.email,
              firstName: req.body.firstName,
              lastName: req.body.lastName,
              role: 'owner',
              tenantId: result.tenantId
            },
            tenant: {
              id: result.tenantId,
              businessName: req.body.businessName,
              slug: result.tenantSlug,
              tier: 'starter',
              onboardingComplete: false
            }
          }
        });
      } else {
        res.status(400).json({
          success: false,
          errors: result.errors
        });
      }
    } catch (error) {
      console.error('Onboarding error:', error);
      res.status(500).json({
        error: 'Onboarding failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Check slug availability (public endpoint for onboarding wizard)
  router.get('/onboarding/check-slug', async (req, res) => {
    try {
      const slug = req.query.slug as string;

      if (!slug || slug.length < 3) {
        res.status(400).json({
          success: false,
          error: 'Slug must be at least 3 characters'
        });
        return;
      }

      // Validate format
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(slug)) {
        res.json({
          success: true,
          data: {
            available: false,
            reason: 'Slug must contain only lowercase letters, numbers, and hyphens'
          }
        });
        return;
      }

      // Check availability
      const result = await pool.query(
        'SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL',
        [slug]
      );

      const available = result.rows.length === 0;

      // Generate suggestions if not available
      const suggestions: string[] = [];
      if (!available) {
        const baseSlug = slug.replace(/-\d+$/, '');
        for (let i = 1; i <= 3; i++) {
          const suggestion = `${baseSlug}-${i}`;
          const checkResult = await pool.query(
            'SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL',
            [suggestion]
          );
          if (checkResult.rows.length === 0) {
            suggestions.push(suggestion);
          }
        }
      }

      res.json({
        success: true,
        data: {
          available,
          suggestions: suggestions.length > 0 ? suggestions : undefined
        }
      });
    } catch (error) {
      console.error('Check slug error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check slug availability'
      });
    }
  });

  // Authentication endpoint
  router.post('/auth/login', validate(loginSchema), async (req, res) => {
    try {
      const { email, password } = req.body;
      const { accessToken, user, tenant } = await authService.login({ email, password }, req.ip || ''); // Pass req.ip

      res.json({
        success: true,
        data: {
          token: accessToken,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            tenantId: tenant.id,
          },
          tenant: {
            id: tenant.id,
            businessName: tenant.name,
            slug: tenant.slug,
            tier: tenant.tier || 'starter',
          },
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error) {
        if (error.message === 'Invalid credentials') { // Exact match for invalid credentials
          res.status(401).json({ error: error.message });
        } else if (error.message.startsWith('Account locked')) { // Check for "Account locked" message
          res.status(423).json({ error: error.message });
        } else if (error.message === 'Tenant account is not active') { // Exact match for inactive tenant
          res.status(403).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Login failed', message: error.message });
        }
      } else {
        res.status(500).json({ error: 'Login failed', message: 'Unknown error' });
      }
    }
  });

  // ============================================================================
  // PUBLIC AI STATS (No auth required for monitoring)
  // ============================================================================

  /**
   * Get AI system statistics - public endpoint for monitoring
   * 
   * GET /api/v1/ai/stats
   */
  router.get('/ai/stats', async (_req, res) => {
    console.log('[AI Stats] Route hit');
    try {
      console.log('[AI Stats] Getting AI router...');
      const aiRouter = getAIRouter(pool, redis);
      console.log('[AI Stats] Got AI router');
      
      // Get provider status
      console.log('[AI Stats] Getting status...');
      const providerStatus = aiRouter.getAllStatus();
      console.log('[AI Stats] Got status:', providerStatus?.length || 0, 'providers');
      
      res.json({
        ok: true,
        providers: providerStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AI Stats] ERROR:', error);
      res.status(500).json({
        error: 'Failed to get AI stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ============================================================================
  // PROTECTED ROUTES (Require authentication and tenant context)
  // ============================================================================

  // Apply tenant middleware and rate limiting to all routes below
  router.use(tenantMiddleware.authenticate);
  router.use(rateLimitMiddleware.limit);

  // ----------------------------------------------------------------------------
  // AUTH - CURRENT USER
  // ----------------------------------------------------------------------------

  // Get current user and tenant info
  router.get('/auth/me', async (req, res) => {
    try {
      const userResult = await pool.query(
        `SELECT id, email, first_name, last_name, role, created_at, last_login_at
         FROM tenant_users WHERE id = $1 AND tenant_id = $2`,
        [req.tenant!.userId, req.tenant!.tenantId]
      );

      const tenantResult = await pool.query(
        `SELECT t.id, t.name, t.slug, t.email, t.status, t.settings, pt.name as tier_name, pt.display_name as tier_display
         FROM tenants t
         JOIN pricing_tiers pt ON t.tier_id = pt.id
         WHERE t.id = $1`,
        [req.tenant!.tenantId]
      );

      if (userResult.rows.length === 0 || tenantResult.rows.length === 0) {
        return apiResponse.notFound(res, 'User or tenant not found');
      }

      const user = userResult.rows[0];
      const tenant = tenantResult.rows[0];

      return res.json({
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            createdAt: user.created_at,
            lastLoginAt: user.last_login_at
          },
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            email: tenant.email,
            status: tenant.status,
            tier: tenant.tier_display,
            settings: tenant.settings
          }
        }
      });
    } catch (error) {
      console.error('Get current user error:', error);
      return apiResponse.serverError(res, 'Failed to get user info');
    }
  });

  // ----------------------------------------------------------------------------
  // DASHBOARD STATISTICS
  // ----------------------------------------------------------------------------

  // Get dashboard stats
  router.get('/dashboard/stats', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - 7);
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Revenue stats
      const revenueResult = await pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN created_at >= $2 THEN total_amount ELSE 0 END), 0) as today,
          COALESCE(SUM(CASE WHEN created_at >= $3 THEN total_amount ELSE 0 END), 0) as this_week,
          COALESCE(SUM(CASE WHEN created_at >= $4 THEN total_amount ELSE 0 END), 0) as this_month
        FROM orders
        WHERE tenant_id = $1 AND payment_status = 'paid'
      `, [tenantId, today.toISOString(), startOfWeek.toISOString(), startOfMonth.toISOString()]);

      // Order stats
      const orderResult = await pool.query(`
        SELECT
          COUNT(CASE WHEN created_at >= $2 THEN 1 END) as today,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
        FROM orders WHERE tenant_id = $1
      `, [tenantId, today.toISOString()]);

      // Customer stats
      const customerResult = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN created_at >= $2 THEN 1 END) as new_this_month
        FROM customers WHERE tenant_id = $1 AND deleted_at IS NULL
      `, [tenantId, startOfMonth.toISOString()]);

      // AI usage stats
      const aiResult = await pool.query(`
        SELECT
          COALESCE(SUM(input_tokens + output_tokens), 0) as tokens_used,
          COALESCE(SUM(cost_usd), 0) as total_cost,
          COUNT(CASE WHEN created_at >= $2 THEN 1 END) as requests_today
        FROM ai_usage WHERE tenant_id = $1
      `, [tenantId, today.toISOString()]);

      // Recent orders
      const recentOrdersResult = await pool.query(`
        SELECT id, customer_name, total_amount, status, created_at
        FROM orders
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `, [tenantId]);

      const revenue = revenueResult.rows[0];
      const orders = orderResult.rows[0];
      const customers = customerResult.rows[0];
      const ai = aiResult.rows[0];

      return res.json({
        data: {
          revenue: {
            today: parseFloat(revenue.today) || 0,
            thisWeek: parseFloat(revenue.this_week) || 0,
            thisMonth: parseFloat(revenue.this_month) || 0,
            percentChange: 12.5 // TODO: Calculate actual change
          },
          orders: {
            today: parseInt(orders.today) || 0,
            pending: parseInt(orders.pending) || 0,
            percentChange: 8.2
          },
          customers: {
            total: parseInt(customers.total) || 0,
            newThisMonth: parseInt(customers.new_this_month) || 0,
            percentChange: 15.3
          },
          aiUsage: {
            tokensUsed: parseInt(ai.tokens_used) || 0,
            costSaved: Math.max(0, (parseInt(ai.tokens_used) || 0) * 0.00003 - parseFloat(ai.total_cost || 0)),
            requestsToday: parseInt(ai.requests_today) || 0
          },
          recentOrders: recentOrdersResult.rows.map(o => ({
            id: o.id,
            customer: o.customer_name || 'Guest',
            total: parseFloat(o.total_amount),
            status: o.status,
            time: getTimeAgo(o.created_at)
          }))
        }
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      return apiResponse.serverError(res, 'Failed to get dashboard stats');
    }
  });

  // Get revenue chart data
  router.get('/dashboard/revenue', async (req, res) => {
    try {
      // Allowlist validation for days parameter
      const validDays = [7, 14, 30, 90];
      const requestedDays = parseInt(req.query.days as string);
      const days = validDays.includes(requestedDays) ? requestedDays : 7;
      const tenantId = req.tenant!.tenantId;

      const result = await pool.query(`
        SELECT
          DATE(created_at) as date,
          COALESCE(SUM(total_amount), 0) as revenue,
          COUNT(*) as orders
        FROM orders
        WHERE tenant_id = $1
          AND created_at >= NOW() - INTERVAL '1 day' * $2
          AND payment_status = 'paid'
        GROUP BY DATE(created_at)
        ORDER BY date
      `, [tenantId, days]);

      res.json({
        data: result.rows.map(r => ({
          date: r.date,
          revenue: parseFloat(r.revenue),
          orders: parseInt(r.orders)
        }))
      });
    } catch (error) {
      console.error('Revenue chart error:', error);
      res.status(500).json({ error: 'Failed to get revenue data' });
    }
  });

  // ----------------------------------------------------------------------------
  // TENANT MANAGEMENT
  // ----------------------------------------------------------------------------

  // Get current tenant info
  router.get('/tenant', tenantController.getTenant);

  // Update tenant settings
  router.patch('/tenant', validate(updateTenantSchema), tenantController.updateTenant);

  // Request data export
  router.post('/tenant/export', dataExportController.requestExport);

  // Get export status
  router.get('/tenant/export/:exportId', dataExportController.getExportStatus);

  // ----------------------------------------------------------------------------
  // LOCATIONS
  // ----------------------------------------------------------------------------

  // List locations
  router.get('/locations', locationController.getLocations);

  // Create location
  router.post('/locations', validate(createLocationSchema), locationController.createLocation);

  // ----------------------------------------------------------------------------
  // MENU ITEMS
  // ----------------------------------------------------------------------------

  // List menu items
  router.get('/menu', menuController.getMenuItems);

  // List menu items (alias for frontend compatibility)
  router.get('/menu/items', menuController.getMenuItems);

  // Create menu item
  router.post('/menu', validate(createMenuItemSchema), menuController.createMenuItem);

  // Create menu item (alias for frontend compatibility)
  router.post('/menu/items', validate(createMenuItemSchema), menuController.createMenuItem);

  // Get menu categories
  router.get('/menu/categories', async (req, res) => {
    try {
      const { MenuService } = await import('../services/tenant/menu.service');
      const menuService = new MenuService(pool);
      const categories = await menuService.getCategories(req.tenant!.tenantId);
      return res.json({ data: categories });
    } catch (error) {
      console.error('Get categories error:', error);
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // Create menu category
  router.post('/menu/categories', async (req, res) => {
    try {
      const { MenuService } = await import('../services/tenant/menu.service');
      const menuService = new MenuService(pool);
      const category = await menuService.createCategory(req.tenant!.tenantId, req.body);
      return res.status(201).json({ data: category });
    } catch (error) {
      console.error('Create category error:', error);
      return res.status(500).json({ error: 'Failed to create category' });
    }
  });

  // ----------------------------------------------------------------------------
  // ORDERS
  // ----------------------------------------------------------------------------

  // List orders
  router.get('/orders', orderController.getOrders);

  // Create order
  router.post('/orders', validate(createOrderSchema), orderController.createOrder);

  // ----------------------------------------------------------------------------
  // RESERVATIONS
  // ----------------------------------------------------------------------------

  // List reservations
  router.get('/reservations', reservationController.getReservations);

  // Create reservation
  router.post('/reservations', validate(createReservationSchema), reservationController.createReservation);

  // ----------------------------------------------------------------------------
  // AI CHATBOT
  // ----------------------------------------------------------------------------

  // List chat sessions
  router.get('/chat/sessions', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const status = req.query.status as string;

      let whereClause = 'WHERE tenant_id = $1';
      const params: (string | number)[] = [tenantId];
      let paramIndex = 2;

      if (status) {
        whereClause += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM chat_conversations ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(`
        SELECT
          cc.id, cc.session_id, cc.channel, cc.status, cc.customer_name,
          cc.customer_email, cc.customer_phone, cc.language, cc.sentiment_score,
          cc.resolved_by_ai, cc.escalated_to_human, cc.created_at, cc.updated_at,
          (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = cc.id) as message_count,
          (SELECT content FROM chat_messages WHERE conversation_id = cc.id ORDER BY created_at DESC LIMIT 1) as last_message
        FROM chat_conversations cc
        ${whereClause}
        ORDER BY cc.updated_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, limit, offset]);

      res.json({
        data: result.rows.map(r => ({
          id: r.id,
          sessionId: r.session_id,
          channel: r.channel,
          status: r.status,
          customerName: r.customer_name,
          customerEmail: r.customer_email,
          customerPhone: r.customer_phone,
          language: r.language,
          sentimentScore: r.sentiment_score ? parseFloat(r.sentiment_score) : null,
          resolvedByAI: r.resolved_by_ai,
          escalatedToHuman: r.escalated_to_human,
          messageCount: parseInt(r.message_count),
          lastMessage: r.last_message,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('List chat sessions error:', error);
      res.status(500).json({ error: 'Failed to list chat sessions' });
    }
  });

  // Get chat messages for a session
  router.get('/chat/sessions/:sessionId/messages', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const sessionId = req.params.sessionId;

      // Find conversation by session_id or id
      const convResult = await pool.query(
        `SELECT id FROM chat_conversations
         WHERE tenant_id = $1 AND (session_id = $2 OR id::text = $2)`,
        [tenantId, sessionId]
      );

      if (convResult.rows.length === 0) {
        return apiResponse.notFound(res, 'Chat session not found');
      }

      const conversationId = convResult.rows[0].id;

      const result = await pool.query(`
        SELECT id, role, content, ai_provider, ai_model, tokens_used, response_time_ms, created_at
        FROM chat_messages
        WHERE tenant_id = $1 AND conversation_id = $2
        ORDER BY created_at ASC
      `, [tenantId, conversationId]);

      return res.json({
        data: result.rows.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          aiProvider: m.ai_provider,
          aiModel: m.ai_model,
          tokensUsed: m.tokens_used,
          responseTimeMs: m.response_time_ms,
          createdAt: m.created_at
        }))
      });
    } catch (error) {
      console.error('Get chat messages error:', error);
      return res.status(500).json({ error: 'Failed to get chat messages' });
    }
  });

  // Chat with AI assistant
  router.post('/chat', validate(chatMessageSchema), async (req, res) => {
    try {
      // Get the singleton AIRouter instance
      const aiRouter = getAIRouter(pool, redis);

      const chatbotService = new ChatbotService(aiRouter, pool, redis);

      const response = await chatbotService.chat({
        tenantId: req.tenant!.tenantId,
        sessionId: req.body.sessionId || crypto.randomUUID(),
        message: req.body.message,
        channel: req.body.channel,
        customerName: req.body.customerName,
        customerEmail: req.body.customerEmail,
        customerPhone: req.body.customerPhone,
        language: req.body.language
      });

      res.json(response);
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({
        error: 'Chat failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ----------------------------------------------------------------------------
  // PARALLEL AI EXECUTION
  // ----------------------------------------------------------------------------

  /**
   * Execute AI request on multiple providers in parallel
   * Returns all responses with consensus analysis
   * 
   * POST /api/v1/ai/parallel
   * Body: {
   *   prompt: string,
   *   systemPrompt?: string,
   *   providers?: ['openai', 'claude', 'gemini'],
   *   taskType?: string,
   *   temperature?: number,
   *   maxTokens?: number
   * }
   */
  router.post('/ai/parallel', async (req, res) => {
    try {
      const aiRouter = getAIRouter(pool, redis);
      const { prompt, systemPrompt, providers, taskType, temperature, maxTokens } = req.body;

      if (!prompt) {
        res.status(400).json({ error: 'prompt is required' });
        return;
      }

      const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const result = await aiRouter.parallel(
        {
          messages,
          tenantId: req.tenant!.tenantId,
          requestType: taskType || 'parallel',
          temperature: temperature ?? 0.7,
          maxTokens: maxTokens ?? 1000
        },
        providers
      );

      res.json({
        success: true,
        consensus: {
          score: result.consensus.score,
          level: result.consensus.level,
          themes: result.consensus.themes,
          recommendation: result.consensus.recommendation
        },
        responses: result.responses.map(r => ({
          provider: r.provider,
          model: r.model,
          content: r.content,
          tokens: r.usage.totalTokens,
          timeMs: r.responseTimeMs
        })),
        errors: result.errors,
        metadata: result.metadata
      });
    } catch (error) {
      console.error('Parallel AI error:', error);
      res.status(500).json({
        error: 'Parallel AI execution failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Race multiple AI providers - return first successful response
   * 
   * POST /api/v1/ai/race
   */
  router.post('/ai/race', async (req, res) => {
    try {
      const aiRouter = getAIRouter(pool, redis);
      const { prompt, systemPrompt, providers, temperature, maxTokens } = req.body;

      if (!prompt) {
        res.status(400).json({ error: 'prompt is required' });
        return;
      }

      const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await aiRouter.race(
        {
          messages,
          tenantId: req.tenant!.tenantId,
          requestType: 'race',
          temperature: temperature ?? 0.7,
          maxTokens: maxTokens ?? 1000
        },
        providers
      );

      res.json({
        success: true,
        provider: response.provider,
        model: response.model,
        content: response.content,
        tokens: response.usage.totalTokens,
        timeMs: response.responseTimeMs
      });
    } catch (error) {
      console.error('AI race error:', error);
      res.status(500).json({
        error: 'AI race failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get AI provider status
   * 
   * GET /api/v1/ai/status
   */
  router.get('/ai/status', async (_req, res) => {
    try {
      const aiRouter = getAIRouter(pool, redis);
      const status = aiRouter.getAllStatus();
      const health = await aiRouter.healthCheckAll();

      res.json({
        providers: status.map(s => ({
          ...s,
          healthy: health[s.provider] ?? false
        })),
        defaultProvider: process.env.DEFAULT_AI_PROVIDER || 'openai',
        localFirst: process.env.LOCAL_AI_FIRST === 'true'
      });
    } catch (error) {
      console.error('AI status error:', error);
      res.status(500).json({
        error: 'Failed to get AI status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get AI usage statistics for tenant
   * 
   * GET /api/v1/ai/usage?days=30
   */
  router.get('/ai/usage', async (req, res) => {
    try {
      const aiRouter = getAIRouter(pool, redis);
      const days = parseInt(req.query.days as string) || 30;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const stats = await aiRouter.getTenantUsageStats(
        req.tenant!.tenantId,
        startDate,
        new Date()
      );

      res.json({
        period: { days, startDate, endDate: new Date() },
        ...stats
      });
    } catch (error) {
      console.error('AI usage error:', error);
      res.status(500).json({
        error: 'Failed to get AI usage',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ----------------------------------------------------------------------------
  // MENU AI
  // ----------------------------------------------------------------------------

  // Enhance menu item with AI
  router.post('/menu/:id/ai-enhance', validate(menuEnhanceSchema), async (req, res) => {
    try {
      const aiRouter = getAIRouter(pool, redis);

      const menuAIService = new MenuAIService(aiRouter, pool);

      // Get menu item
      const itemResult = await pool.query(
        `SELECT id, name, description, price, category_id
         FROM menu_items WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, req.tenant!.tenantId]
      );

      if (itemResult.rows.length === 0) {
        res.status(404).json({ error: 'Menu item not found' });
        return;
      }

      const item = itemResult.rows[0];
      const enhancements: Record<string, unknown> = {};

      // Generate description if requested
      if (req.body.generateDescription) {
        enhancements.aiDescription = await menuAIService.generateDescription(
          req.tenant!.tenantId,
          {
            name: item.name,
            description: item.description,
            price: parseFloat(item.price)
          },
          req.body.style
        );
      }

      // Detect allergens if requested
      if (req.body.detectAllergens) {
        enhancements.allergens = await menuAIService.detectAllergens(
          req.tenant!.tenantId,
          { name: item.name, description: item.description }
        );
      }

      // Translate if requested
      if (req.body.translateTo?.length) {
        enhancements.translations = await menuAIService.translateMenuItem(
          req.tenant!.tenantId,
          { name: item.name, description: enhancements.aiDescription as string || item.description },
          req.body.translateTo
        );
      }

      // Update menu item with AI description if generated
      if (enhancements.aiDescription) {
        await pool.query(
          `UPDATE menu_items SET ai_description = $1 WHERE id = $2`,
          [enhancements.aiDescription, req.params.id]
        );
      }

      res.json({
        menuItemId: req.params.id,
        enhancements
      });
    } catch (error) {
      console.error('Menu AI enhance error:', error);
      res.status(500).json({
        error: 'AI enhancement failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ----------------------------------------------------------------------------
  // RECOMMENDATIONS / UPSELLING
  // ----------------------------------------------------------------------------

  // Get personalized recommendations
  router.get('/recommendations', validate(recommendationsSchema), async (req, res) => {
    try {
      const aiRouter = getAIRouter(pool, redis);

      const upsellService = new UpsellService(pool, redis, aiRouter);

      const recommendations = await upsellService.getRecommendations(
        {
          tenantId: req.tenant!.tenantId,
          locationId: req.query.locationId as string | undefined,
          customerId: req.query.customerId as string | undefined,
          timeOfDay: req.query.context as 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'default' | undefined
        },
        parseInt(req.query.limit as string) || 5,
        req.query.includeReasons !== 'false'
      );

      res.json(recommendations);
    } catch (error) {
      console.error('Recommendations error:', error);
      res.status(500).json({
        error: 'Failed to get recommendations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ----------------------------------------------------------------------------
  // REVIEWS & AI RESPONSES
  // ----------------------------------------------------------------------------

  // List reviews
  router.get('/reviews', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const sentiment = req.query.sentiment as string;
      const platform = req.query.platform as string;

      let whereClause = 'WHERE tenant_id = $1';
      const params: (string | number)[] = [tenantId];
      let paramIndex = 2;

      if (sentiment) {
        whereClause += ` AND sentiment = $${paramIndex}`;
        params.push(sentiment);
        paramIndex++;
      }

      if (platform) {
        whereClause += ` AND platform = $${paramIndex}`;
        params.push(platform);
        paramIndex++;
      }

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM reviews ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(`
        SELECT
          id, platform, external_review_id, reviewer_name, rating,
          review_text, review_date, response_text, response_generated_by,
          response_date, sentiment, sentiment_score, keywords, created_at
        FROM reviews
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, limit, offset]);

      res.json({
        data: result.rows.map(r => ({
          id: r.id,
          platform: r.platform,
          externalId: r.external_review_id,
          reviewerName: r.reviewer_name,
          rating: r.rating,
          reviewText: r.review_text,
          reviewDate: r.review_date,
          responseText: r.response_text,
          responseGeneratedBy: r.response_generated_by,
          responseDate: r.response_date,
          sentiment: r.sentiment,
          sentimentScore: r.sentiment_score ? parseFloat(r.sentiment_score) : null,
          keywords: r.keywords,
          createdAt: r.created_at
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('List reviews error:', error);
      res.status(500).json({ error: 'Failed to list reviews' });
    }
  });

  // Create/import a review
  router.post('/reviews', validate(createReviewSchema), async (req, res) => {
    try {
      const aiRouter = getAIRouter(pool, redis);

      const reviewService = new ReviewAIService(pool, aiRouter);

      const review = await reviewService.saveReview({
        tenantId: req.tenant!.tenantId,
        locationId: req.body.locationId,
        source: req.body.source,
        rating: req.body.rating,
        reviewerName: req.body.reviewerName,
        reviewText: req.body.reviewText,
        reviewDate: req.body.reviewDate ? new Date(req.body.reviewDate) : new Date(),
        externalId: req.body.externalId
      });

      res.status(201).json(review);
    } catch (error) {
      console.error('Create review error:', error);
      res.status(500).json({
        error: 'Failed to create review',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Generate AI response for a review
  router.post('/reviews/:id/ai-respond', validate(reviewResponseSchema), async (req, res) => {
    try {
      const aiRouter = getAIRouter(pool, redis);

      const reviewService = new ReviewAIService(pool, aiRouter);

      // Get the review
      const review = await reviewService.getReview(req.tenant!.tenantId, req.params.id);
      if (!review) {
        res.status(404).json({ error: 'Review not found' });
        return;
      }

      // Generate response
      const response = await reviewService.generateResponse(
        req.tenant!.tenantId,
        review,
        {
          tone: req.body.tone,
          maxLength: req.body.maxLength,
          includeOffer: req.body.includeOffer,
          customInstructions: req.body.customInstructions
        }
      );

      // Save the generated response
      await reviewService.saveAIResponse(req.tenant!.tenantId, req.params.id, response.response);

      res.json({
        reviewId: req.params.id,
        ...response
      });
    } catch (error) {
      console.error('Review AI respond error:', error);
      res.status(500).json({
        error: 'Failed to generate response',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get review insights
  router.get('/reviews/insights', async (req, res) => {
    try {
      const aiRouter = getAIRouter(pool, redis);
      const reviewService = new ReviewAIService(pool, aiRouter);

      const insights = await reviewService.getInsights(
        req.tenant!.tenantId,
        req.query.locationId as string | undefined,
        req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        req.query.endDate ? new Date(req.query.endDate as string) : undefined
      );

      res.json(insights);
    } catch (error) {
      console.error('Review insights error:', error);
      res.status(500).json({
        error: 'Failed to get insights',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ----------------------------------------------------------------------------
  // BILLING & SUBSCRIPTION
  // ----------------------------------------------------------------------------

  // Get billing info
  router.get('/billing', async (req, res) => {
    try {
      const billingService = new BillingService(pool, process.env.STRIPE_SECRET_KEY || '');

      const billingInfo = await billingService.getBillingInfo(req.tenant!.tenantId);
      res.json(billingInfo);
    } catch (error) {
      console.error('Get billing info error:', error);
      res.status(500).json({
        error: 'Failed to get billing info',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get available pricing tiers
  router.get('/billing/tiers', async (_req, res) => {
    try {
      const billingService = new BillingService(pool, process.env.STRIPE_SECRET_KEY || '');

      const tiers = await billingService.getPricingTiers();
      res.json({ data: tiers });
    } catch (error) {
      console.error('Get pricing tiers error:', error);
      res.status(500).json({
        error: 'Failed to get pricing tiers',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create checkout session
  router.post('/billing/checkout', async (req, res) => {
    try {
      const billingService = new BillingService(pool, process.env.STRIPE_SECRET_KEY || '');

      const { tier, interval, successUrl, cancelUrl } = req.body;

      if (!tier || !successUrl || !cancelUrl) {
        return apiResponse.badRequest(res, 'Missing required fields: tier, successUrl, cancelUrl');
      }

      const session = await billingService.createCheckoutSession(
        req.tenant!.tenantId,
        tier,
        interval || 'monthly',
        successUrl,
        cancelUrl
      );

      return res.json(session);
    } catch (error) {
      console.error('Create checkout session error:', error);
      return res.status(500).json({
        error: 'Failed to create checkout session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create customer portal session
  router.post('/billing/portal', async (req, res) => {
    try {
      const billingService = new BillingService(pool, process.env.STRIPE_SECRET_KEY || '');

      const { returnUrl } = req.body;

      if (!returnUrl) {
        res.status(400).json({ error: 'Missing required field: returnUrl' });
        return;
      }

      const session = await billingService.createPortalSession(
        req.tenant!.tenantId,
        returnUrl
      );

      res.json(session);
    } catch (error) {
      console.error('Create portal session error:', error);
      res.status(500).json({
        error: 'Failed to create portal session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ----------------------------------------------------------------------------
  // NOTIFICATIONS
  // ----------------------------------------------------------------------------

  // Get notification preferences
  router.get('/notifications/preferences', async (req, res) => {
    try {
      const emailService = new EmailService(pool);

      const preferences = await emailService.getPreferences(req.tenant!.userId);
      res.json({ success: true, data: preferences });
    } catch (error) {
      console.error('Get notification preferences error:', error);
      res.status(500).json({
        error: 'Failed to get preferences',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update notification preferences
  router.patch('/notifications/preferences', async (req, res) => {
    try {
      const emailService = new EmailService(pool);

      await emailService.updatePreferences(req.tenant!.userId, req.body);
      res.json({ success: true, data: { updated: true } });
    } catch (error) {
      console.error('Update notification preferences error:', error);
      res.status(500).json({
        error: 'Failed to update preferences',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Send test email (for demo)
  router.post('/notifications/test', async (req, res) => {
    try {
      const emailService = new EmailService(pool);

      const { type } = req.body;

      // Get user info
      const userResult = await pool.query(
        `SELECT email, first_name FROM tenant_users WHERE id = $1`,
        [req.tenant!.userId]
      );
      const tenantResult = await pool.query(
        `SELECT name FROM tenants WHERE id = $1`,
        [req.tenant!.tenantId]
      );

      const user = userResult.rows[0];
      const tenant = tenantResult.rows[0];

      let result;
      switch (type) {
        case 'welcome':
          result = await emailService.sendWelcome(user.email, user.first_name, tenant.name);
          break;
        case 'review':
          result = await emailService.sendReviewAlert(user.email, {
            businessName: tenant.name,
            reviewerName: 'Test Customer',
            rating: 5,
            reviewText: 'This is a test review notification. Great restaurant!',
            platform: 'Google'
          });
          break;
        case 'digest':
          result = await emailService.sendWeeklyDigest(user.email, tenant.name, {
            revenue: 12500,
            orders: 145,
            newReviews: 8,
            avgRating: 4.6
          });
          break;
        default:
          res.status(400).json({ error: 'Invalid email type' });
          return;
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Send test email error:', error);
      res.status(500).json({
        error: 'Failed to send test email',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ----------------------------------------------------------------------------
  // INTEGRATIONS - GOOGLE BUSINESS
  // ----------------------------------------------------------------------------

  // Get Google Business connection status
  router.get('/integrations/google-business/status', async (req, res) => {
    try {
      const googleService = new GoogleBusinessService(pool);

      const status = await googleService.getConnectionStatus(req.tenant!.tenantId);
      res.json({ success: true, data: status });
    } catch (error) {
      console.error('Get Google Business status error:', error);
      res.status(500).json({
        error: 'Failed to get connection status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Connect to Google Business Profile
  router.post('/integrations/google-business/connect', async (req, res) => {
    try {
      const googleService = new GoogleBusinessService(pool);

      const { businessName, address } = req.body;

      if (!businessName) {
        res.status(400).json({ error: 'Business name is required' });
        return;
      }

      const result = await googleService.connect(
        req.tenant!.tenantId,
        businessName,
        address
      );

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Connect Google Business error:', error);
      res.status(500).json({
        error: 'Failed to connect',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Disconnect from Google Business Profile
  router.post('/integrations/google-business/disconnect', async (req, res) => {
    try {
      const googleService = new GoogleBusinessService(pool);

      await googleService.disconnect(req.tenant!.tenantId);
      res.json({ success: true, data: { disconnected: true } });
    } catch (error) {
      console.error('Disconnect Google Business error:', error);
      res.status(500).json({
        error: 'Failed to disconnect',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Sync reviews from Google Business
  router.post('/integrations/google-business/sync', async (req, res) => {
    try {
      const googleService = new GoogleBusinessService(pool);

      const { locationId } = req.body;
      const result = await googleService.syncReviews(req.tenant!.tenantId, locationId);

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Sync Google reviews error:', error);
      res.status(500).json({
        error: 'Failed to sync reviews',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Search Google Business profiles (for connecting)
  router.get('/integrations/google-business/search', async (req, res) => {
    try {
      const googleService = new GoogleBusinessService(pool);

      const query = req.query.q as string;
      if (!query || query.length < 2) {
        res.status(400).json({ error: 'Search query must be at least 2 characters' });
        return;
      }

      const results = await googleService.searchProfiles(query);
      res.json({ success: true, data: results });
    } catch (error) {
      console.error('Search Google Business error:', error);
      res.status(500).json({
        error: 'Failed to search',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ----------------------------------------------------------------------------
  // ONBOARDING (protected routes for wizard completion)
  // ----------------------------------------------------------------------------

  // Get onboarding status
  router.get('/onboarding/status', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const result = await pool.query(`
        SELECT
          t.name, t.slug, t.email as contact_email, 
          COALESCE((t.settings->>'onboarding_complete')::boolean, false) as onboarding_complete,
          COALESCE(t.settings->>'onboarding_step', 'business') as onboarding_step, t.settings,
          (SELECT COUNT(*) FROM locations WHERE tenant_id = t.id AND deleted_at IS NULL) as location_count,
          (SELECT COUNT(*) FROM menu_items WHERE tenant_id = t.id AND deleted_at IS NULL) as menu_count
        FROM tenants t
        WHERE t.id = $1
      `, [tenantId]);

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      const tenant = result.rows[0];
      const completedSteps: string[] = [];

      // Determine completed steps
      if (tenant.name && tenant.slug) completedSteps.push('business');
      if (tenant.settings?.selectedPlan) completedSteps.push('plan');
      if (parseInt(tenant.location_count) > 0 || tenant.settings?.skippedLocation) completedSteps.push('location');
      if (tenant.onboarding_complete) completedSteps.push('complete');

      // Determine current step
      let currentStep = 'business';
      if (completedSteps.includes('business') && !completedSteps.includes('plan')) currentStep = 'plan';
      else if (completedSteps.includes('plan') && !completedSteps.includes('location')) currentStep = 'location';
      else if (completedSteps.includes('location') && !completedSteps.includes('complete')) currentStep = 'complete';
      else if (completedSteps.includes('complete')) currentStep = 'done';

      res.json({
        success: true,
        data: {
          isComplete: tenant.onboarding_complete || false,
          completedSteps,
          currentStep
        }
      });
    } catch (error) {
      console.error('Get onboarding status error:', error);
      res.status(500).json({
        error: 'Failed to get onboarding status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Complete onboarding wizard
  router.post('/onboarding/complete', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const {
        businessName,
        slug,
        contactEmail,
        contactPhone,
        businessType,
        pricingTier,
        billingInterval,
        firstLocation
      } = req.body;

      // Validate required fields
      if (!businessName || !slug || !contactEmail || !pricingTier) {
        res.status(400).json({
          error: 'Missing required fields: businessName, slug, contactEmail, pricingTier'
        });
        return;
      }

      // Check slug availability (only if different from current)
      const currentTenant = await pool.query(
        'SELECT slug FROM tenants WHERE id = $1',
        [tenantId]
      );

      if (currentTenant.rows[0].slug !== slug) {
        const slugCheck = await pool.query(
          'SELECT id FROM tenants WHERE slug = $1 AND id != $2 AND deleted_at IS NULL',
          [slug, tenantId]
        );

        if (slugCheck.rows.length > 0) {
          res.status(400).json({ error: 'Slug is already taken' });
          return;
        }
      }

      // Get pricing tier ID
      const tierResult = await pool.query(
        'SELECT id FROM pricing_tiers WHERE name = $1',
        [pricingTier]
      );

      if (tierResult.rows.length === 0) {
        res.status(400).json({ error: 'Invalid pricing tier' });
        return;
      }

      const tierId = tierResult.rows[0].id;

      // Update tenant
      await pool.query(`
        UPDATE tenants SET
          name = $1,
          slug = $2,
          email = $3,
          tier_id = $4,
          settings = settings || $5::jsonb,
          updated_at = NOW()
        WHERE id = $6
      `, [
        businessName,
        slug,
        contactEmail,
        tierId,
        JSON.stringify({
          onboarding_complete: true,
          onboarding_step: 'complete',
          contactPhone: contactPhone || null,
          businessType: businessType || 'restaurant',
          selectedPlan: pricingTier,
          billingInterval: billingInterval || 'monthly',
          skippedLocation: !firstLocation
        }),
        tenantId
      ]);

      // Create first location if provided
      if (firstLocation) {
        const locationId = uuidv4();
        const locationSlug = firstLocation.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        await pool.query(`
          INSERT INTO locations (
            id, tenant_id, name, slug,
            address_line1, city, state, postal_code, country,
            is_primary, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (tenant_id, slug) DO NOTHING
        `, [
          locationId,
          tenantId,
          firstLocation.name,
          locationSlug,
          firstLocation.address,
          firstLocation.city,
          firstLocation.state || '',
          firstLocation.postalCode || '',
          firstLocation.country || 'US',
          true,
          true
        ]);
      }

      res.json({
        success: true,
        data: {
          success: true,
          message: 'Onboarding completed successfully'
        }
      });
    } catch (error) {
      console.error('Complete onboarding error:', error);
      res.status(500).json({
        error: 'Failed to complete onboarding',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ============================================================================
  // NEW MODULE ROUTES (Food Safety, Reviews, Content, Intelligence)
  // ============================================================================

  // Food Safety & Compliance Module
  router.use('/compliance', createComplianceRouter(pool));

  // Review Management Module (Guest Whisperer)
  router.use('/review-management', createReviewsRouter(pool));

  // Content Planner Module (TikTok/Social)
  router.use('/content', createContentRouter(pool));

  // Business Intelligence & Automation Module
  router.use('/intelligence', createIntelligenceRouter(pool));

  // AI Orchestration routes
  router.use('/ai', createAIRouter(pool));

  // Multi-agent management routes (Phase 1)
  const agentService = new AgentService(pool);
  const chatService = new ChatService(pool, agentService);
  const agentRouter = createAgentRouter(agentService, chatService);
  router.use('/tenant/agent', agentRouter);

  // ============================================================================
  // FRONTEND COMPATIBILITY ROUTES
  // These alias the agent routes to match what the frontend expects
  // ============================================================================

  // GET /chat/sessions → /tenant/agent/conversations
  router.get('/chat/sessions', tenantMiddleware.authenticate, async (req, res) => {
    const tenantId = (req as AuthenticatedRequest).tenant?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const options = {
        status: req.query.status as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.page ? (parseInt(req.query.page as string) - 1) * 50 : 0,
      };
      const conversations = await agentService.getConversations(tenantId, options);
      
      // Map to frontend expected format (webchat → web for frontend compatibility)
      const channelMap: Record<string, string> = { webchat: 'web', telegram: 'telegram', whatsapp: 'whatsapp' };
      res.json({
        items: conversations.map((c: { id: string; channel: string; customer_name?: string; status: string; message_count: number; escalated_to_human: boolean; created_at: Date; last_message_at?: Date }) => ({
          id: c.id,
          sessionId: c.id,
          customerName: c.customer_name || 'Guest',
          channel: channelMap[c.channel] || c.channel,
          status: c.status,
          messageCount: c.message_count,
          resolvedByAi: c.status === 'closed' && !c.escalated_to_human,
          escalatedToHuman: c.escalated_to_human,
          createdAt: c.created_at,
          updatedAt: c.last_message_at || c.created_at,
          lastMessage: null, // Would need extra query to populate
        })),
        total: conversations.length,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        pageSize: 50,
      });
    } catch (error) {
      logger.error('Failed to get chat sessions', { error, tenantId });
      res.status(500).json({ error: 'Failed to get sessions' });
    }
  });

  // GET /chat/sessions/:id/messages → /tenant/agent/conversations/:id/messages
  router.get('/chat/sessions/:id/messages', tenantMiddleware.authenticate, async (req, res) => {
    const tenantId = (req as AuthenticatedRequest).tenant?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const messages = await agentService.getMessages(tenantId, req.params.id, 50);
      res.json({
        data: messages.map((m: { id: string; role: string; content: string; model_used?: string; latency_ms?: number; created_at: Date }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          aiProvider: m.model_used ? 'ai' : null,
          aiModel: m.model_used,
          responseTimeMs: m.latency_ms,
          createdAt: m.created_at,
        })),
      });
    } catch (error) {
      logger.error('Failed to get chat messages', { error, tenantId });
      res.status(500).json({ error: 'Failed to get messages' });
    }
  });

  // POST /chat → /tenant/agent/chat
  router.post('/chat', tenantMiddleware.authenticate, async (req, res) => {
    const tenantId = (req as AuthenticatedRequest).tenant?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const chatRequest = {
        message: req.body.message,
        channel: 'webchat' as const,
        external_chat_id: req.body.sessionId || `web-${Date.now()}`,
        conversation_id: req.body.sessionId,
      };

      if (!chatRequest.message?.trim()) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const response = await chatService.processMessage(tenantId, chatRequest);
      res.json({
        data: {
          response: response.message,
          sessionId: response.conversation_id,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Chat error', { error, tenantId });
      
      if (message.includes('not configured')) {
        return res.status(404).json({ error: 'Agent not configured. Please set up your AI agent first.' });
      }
      if (message.includes('not active')) {
        return res.status(503).json({ error: 'Agent is not active' });
      }
      
      res.status(500).json({ error: 'Failed to process message' });
    }
  });

  return router;
}

// ============================================================================
// STRIPE WEBHOOK HANDLER (Separate from authenticated routes)
// ============================================================================

export function createWebhookRouter(pool: Pool): Router {
  const router = Router();

  // Stripe webhook (needs raw body)
  router.post('/stripe', async (req, res) => {
    try {
      const billingService = new BillingService(pool, process.env.STRIPE_SECRET_KEY || '');

      const signature = req.headers['stripe-signature'] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error('Stripe webhook secret not configured');
        res.status(500).json({ error: 'Webhook not configured' });
        return;
      }

      // Verify and construct event
      const event = billingService.verifyWebhookSignature(
        req.body, // This should be raw body
        signature,
        webhookSecret
      );

      // Handle the event
      await billingService.handleWebhook(event);

      res.json({ received: true });
    } catch (error) {
      console.error('Stripe webhook error:', error);
      res.status(400).json({
        error: 'Webhook error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}

export default createApiRouter;
