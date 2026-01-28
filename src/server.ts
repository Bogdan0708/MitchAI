/**
 * MAIN APPLICATION SERVER
 *
 * Entry point for the multi-tenant hospitality platform API
 */

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
// MIDDLEWARE
// ============================================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: config.nodeEnv === 'production',
  crossOriginEmbedderPolicy: config.nodeEnv === 'production'
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
const ipRateLimiter = new IPRateLimiter(redis, 60000, 1000); // 1000 requests per minute per IP
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

// Health check endpoint (for load balancers & monitoring)
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

// Readiness check (for Kubernetes/ECS)
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
});

// 404 handler
app.all('*', (req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

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
