/**
 * MAIN APPLICATION SERVER
 *
 * Entry point for the multi-tenant hospitality platform API
 */

// Sentry must be initialized before other imports
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
  });
  console.log('[Sentry] Error tracking initialized');
}

import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { Pool } from 'pg';
import Redis from 'ioredis';
import Stripe from 'stripe';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { createApiRouter } from './routes/api.routes';
import { IPRateLimiter } from './middleware/rateLimit.middleware';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { csrfProtection } from './middleware/csrf.middleware';
import { SyncApiUsageJob } from './jobs/sync-api-usage.job';

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  database: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    min: parseInt(process.env.DATABASE_POOL_MIN || '2'),
    max: parseInt(process.env.DATABASE_POOL_MAX || '10'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectTimeout: 10000
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET!, // Enforce JWT_SECRET to be set
    expiration: process.env.JWT_EXPIRATION || '7d'
  },

  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
  },

  // CORS
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000']
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info'
};

// ============================================================================
// INITIALIZE SERVICES
// ============================================================================

// PostgreSQL connection pool
const pool = new Pool(config.database);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
  process.exit(-1);
});

// Redis client
const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
  enableReadyCheck: config.redis.enableReadyCheck,
  connectTimeout: config.redis.connectTimeout,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

// Handle Redis errors
redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

// Stripe client
const stripe = new Stripe(config.stripe.secretKey);

// ============================================================================
// CREATE EXPRESS APP
// ============================================================================

const app: Express = express();

// ============================================================================
// HEALTH CHECK ENDPOINTS (BEFORE ALL MIDDLEWARE)
// ============================================================================
// These endpoints MUST be before CORS middleware because:
// - ALB/ELB health checks are server-to-server requests without Origin header
// - CORS middleware rejects requests without Origin in production
// - Health checks would fail with 500 error if they go through CORS

// Simple ping for ALB health checks (fastest response)
app.get('/ping', (_req: Request, res: Response) => {
  res.status(200).send('pong');
});

// Detailed health check for monitoring (checks DB & Redis)
app.get('/health', async (_req: Request, res: Response) => {
  const health: {
    status: string;
    timestamp: string;
    uptime: number;
    checks: Record<string, { status: string; latency?: number; error?: string }>;
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };

  // Check database
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    health.checks.database = { status: 'healthy', latency: Date.now() - start };
  } catch (error) {
    health.checks.database = { status: 'unhealthy', error: (error as Error).message };
    health.status = 'degraded';
  }

  // Check Redis
  try {
    const start = Date.now();
    await redis.ping();
    health.checks.redis = { status: 'healthy', latency: Date.now() - start };
  } catch (error) {
    health.checks.redis = { status: 'unhealthy', error: (error as Error).message };
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Readiness check for Kubernetes/ECS (simpler than /health)
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security headers - comprehensive protection
app.use(helmet({
  // Content Security Policy - strict for API server
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"], // Prevent clickjacking
      formAction: ["'self'"],
      upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null,
    },
  },
  // Cross-Origin policies
  crossOriginEmbedderPolicy: config.nodeEnv === 'production',
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  // HSTS - force HTTPS for 1 year
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  // Prevent MIME type sniffing
  noSniff: true,
  // XSS filter (legacy browsers)
  xssFilter: true,
  // Hide X-Powered-By header
  hidePoweredBy: true,
  // Referrer policy
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  // DNS prefetch control
  dnsPrefetchControl: { allow: false },
  // Don't cache sensitive responses
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
}));

// CORS - Strict configuration to prevent CSRF attacks
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // In production, reject requests with no origin (browser security)
    // Allow no-origin only for server-to-server requests in development
    if (!origin) {
      if (config.nodeEnv === 'production') {
        // In production, only allow no-origin for specific paths (webhooks)
        // This is handled per-route, so reject here by default
        return callback(new Error('Origin required in production'));
      }
      return callback(null, true);
    }

    if (config.cors.origins.includes(origin)) {
      callback(null, true);
    } else if (config.nodeEnv === 'development' && origin.startsWith('http://localhost')) {
      // In development, allow localhost origins
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token']
}));

// Compression
app.use(compression());

// Stripe webhooks (before body parsing middleware)
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const sig = req.headers['stripe-signature'] as string;

    if (!config.stripe.webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.stripe.webhookSecret
    );

    // Handle webhook events
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled webhook event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// ============================================================================
// AGENT WEBHOOKS (Telegram/WhatsApp - before body parsing)
// ============================================================================

import { AgentService } from './services/agents/agent.service';
import { ChatService } from './services/agents/chat.service';

// Telegram webhook
app.post('/webhooks/telegram/:tenantId', express.json(), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const update = req.body;

    // Validate Telegram update structure
    if (!update.message && !update.callback_query) {
      return res.json({ ok: true }); // Ignore non-message updates
    }

    const message = update.message || update.callback_query?.message;
    if (!message?.text || !message?.chat?.id) {
      return res.json({ ok: true });
    }

    const agentService = new AgentService(pool);
    const chatService = new ChatService(pool, agentService);

    // Process message
    const response = await chatService.processMessage(tenantId, {
      channel: 'telegram',
      external_chat_id: message.chat.id.toString(),
      external_message_id: message.message_id?.toString(),
      message: message.text,
      customer_name: message.from?.first_name || message.from?.username,
    });

    // Send response back to Telegram
    if (response.message) {
      const agent = await agentService.getAgent(tenantId);
      if (agent?.has_telegram) {
        // Note: In production, use Telegram Bot API to send response
        // For now, just log - actual sending would require decrypting bot token
        console.log(`Would send Telegram response to chat ${message.chat.id}: ${response.message.substring(0, 50)}...`);
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    res.json({ ok: true }); // Always respond 200 to Telegram
  }
});

// WhatsApp webhook (verification)
app.get('/webhooks/whatsapp/:tenantId', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // TODO: Validate token against stored webhook secret for tenant
  if (mode === 'subscribe' && token) {
    console.log('WhatsApp webhook verified for tenant:', req.params.tenantId);
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// WhatsApp webhook (messages)
app.post('/webhooks/whatsapp/:tenantId', express.json(), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const body = req.body;

    // WhatsApp sends verification pings
    if (body.object !== 'whatsapp_business_account') {
      return res.sendStatus(200);
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages?.length) {
      return res.sendStatus(200);
    }

    const message = messages[0];
    if (message.type !== 'text') {
      return res.sendStatus(200); // Only handle text messages for now
    }

    const agentService = new AgentService(pool);
    const chatService = new ChatService(pool, agentService);

    // Process message
    await chatService.processMessage(tenantId, {
      channel: 'whatsapp',
      external_chat_id: message.from,
      external_message_id: message.id,
      message: message.text?.body || '',
      customer_name: value.contacts?.[0]?.profile?.name,
      customer_phone: message.from,
    });

    res.sendStatus(200);
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.sendStatus(200); // Always respond 200
  }
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID tracking (must be early in middleware chain)
app.use(requestIdMiddleware);

// CSRF Protection for state-changing requests
// Requires X-Requested-With header which prevents CSRF via same-origin policy
app.use(csrfProtection);

// Logging with request ID
if (config.nodeEnv === 'development') {
  app.use(morgan(':method :url :status :response-time ms - :req[x-request-id]'));
} else {
  app.use(morgan('combined'));
}

// Trust proxy (for rate limiting by IP behind reverse proxy)
app.set('trust proxy', 1);

// Global IP-based rate limiting (DDoS protection)
const ipRateLimiter = new IPRateLimiter(redis, 60000, 300); // 300 requests per minute per IP (DDoS protection)
app.use(ipRateLimiter.limit);

// ============================================================================
// ROUTES
// ============================================================================

// API Documentation (Swagger UI)
try {
  const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Mitch Hospitality API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true
    }
  }));
} catch (error) {
  console.warn('Swagger documentation not loaded:', error);
}

// API routes
app.use('/api/v1', createApiRouter(pool, redis, config.jwt.secret));

import { errorHandler, AppError } from './middleware/error.middleware';

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Mitch Hospitality SaaS',
    version: '1.0.0',
    status: 'running',
    environment: config.nodeEnv,
    docs: '/api-docs',
    api: '/api/v1'
  });
});

// Note: /health, /ready, /ping are defined BEFORE CORS middleware (top of file)
// to ensure ALB/ELB health checks work without Origin header

// 404 handler
app.all('*', (req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Sentry error handler (must be before other error handlers)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Error handler
app.use(errorHandler);

// ============================================================================
// STRIPE WEBHOOK HANDLERS
// ============================================================================

async function handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
  try {
    const customerId = subscription.customer as string;

    await pool.query(
      `UPDATE tenants
      SET subscription_status = $1,
          stripe_subscription_id = $2,
          status = CASE
            WHEN $1 = 'active' THEN 'active'
            WHEN $1 = 'past_due' THEN 'suspended'
            ELSE status
          END
      WHERE stripe_customer_id = $3`,
      [subscription.status, subscription.id, customerId]
    );

    console.log(`Subscription updated for customer ${customerId}: ${subscription.status}`);
  } catch (error) {
    console.error('Error updating subscription:', error);
  }
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription): Promise<void> {
  try {
    const customerId = subscription.customer as string;

    await pool.query(
      `UPDATE tenants
      SET subscription_status = 'canceled',
          status = 'suspended'
      WHERE stripe_customer_id = $1`,
      [customerId]
    );

    console.log(`Subscription canceled for customer ${customerId}`);
  } catch (error) {
    console.error('Error canceling subscription:', error);
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  try {
    const customerId = invoice.customer as string;

    // Log successful payment
    await pool.query(
      `INSERT INTO audit_logs (tenant_id, action, metadata)
      SELECT id, 'payment.succeeded', $2
      FROM tenants WHERE stripe_customer_id = $1`,
      [customerId, JSON.stringify({ invoiceId: invoice.id, amount: invoice.amount_paid })]
    );

    console.log(`Payment succeeded for customer ${customerId}`);
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  try {
    const customerId = invoice.customer as string;

    // Update tenant status
    await pool.query(
      `UPDATE tenants
      SET subscription_status = 'past_due'
      WHERE stripe_customer_id = $1`,
      [customerId]
    );

    // Log failed payment
    await pool.query(
      `INSERT INTO audit_logs (tenant_id, action, metadata)
      SELECT id, 'payment.failed', $2
      FROM tenants WHERE stripe_customer_id = $1`,
      [customerId, JSON.stringify({ invoiceId: invoice.id, attemptCount: invoice.attempt_count })]
    );

    console.log(`Payment failed for customer ${customerId}`);
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received. Starting graceful shutdown...`);

  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed');
  });

  // Close database connections
  try {
    await pool.end();
    console.log('Database pool closed');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }

  // Close Redis connection
  try {
    await redis.quit();
    console.log('Redis connection closed');
  } catch (error) {
    console.error('Error closing Redis connection:', error);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================================================
// START SERVER
// ============================================================================

const server = app.listen(config.port, async () => {
  console.log('==========================================');
  console.log('  Hospitality SaaS Platform API');
  console.log('==========================================');
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Server: http://localhost:${config.port}`);
  console.log(`API: http://localhost:${config.port}/api/v1`);
  console.log(`API Docs: http://localhost:${config.port}/api-docs`);

  // Test database connection
  try {
    await pool.query('SELECT NOW()');
    console.log('Database: Connected ✓');
  } catch (error) {
    console.error('Database: Connection failed ✗');
    console.error(error);
  }

  // Test Redis connection
  try {
    await redis.ping();
    console.log('Redis: Connected ✓');
  } catch (error) {
    console.error('Redis: Connection failed ✗');
    console.error(error);
  }

  console.log('==========================================');

  // Start background jobs
  const syncApiUsageJob = new SyncApiUsageJob(pool, redis);
  syncApiUsageJob.start();
});

export default app;
