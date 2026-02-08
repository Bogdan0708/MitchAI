/**
 * RATE LIMITING MIDDLEWARE
 *
 * Implements per-tenant rate limiting based on pricing tiers
 * Uses Redis for distributed rate limiting across multiple instances
 */

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import Redis from 'ioredis';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
  statusCode?: number;
}

export interface TierRateLimits {
  starter: RateLimitConfig;
  professional: RateLimitConfig;
  enterprise: RateLimitConfig;
}

// ============================================================================
// RATE LIMIT MIDDLEWARE
// ============================================================================

export class RateLimitMiddleware {
  private redis: Redis;
  private pool: Pool;
  private tierLimits: TierRateLimits;

  constructor(redis: Redis, pool: Pool, customLimits?: Partial<TierRateLimits>) {
    this.redis = redis;
    this.pool = pool;

    // Default rate limits per tier
    this.tierLimits = {
      starter: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100, // 100 requests per minute
        message: 'Rate limit exceeded for Starter tier',
        statusCode: 429
      },
      professional: {
        windowMs: 60 * 1000,
        maxRequests: 500, // 500 requests per minute
        message: 'Rate limit exceeded for Professional tier',
        statusCode: 429
      },
      enterprise: {
        windowMs: 60 * 1000,
        maxRequests: 2000, // 2000 requests per minute
        message: 'Rate limit exceeded for Enterprise tier',
        statusCode: 429
      },
      ...customLimits
    };
  }

  /**
   * Main rate limiting middleware
   * Checks both per-minute and monthly limits
   */
  limit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Require tenant context
      if (!req.tenant) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
        return;
      }

      const { tenantId, tier } = req.tenant;
      const tierName = tier.name.toLowerCase() as keyof TierRateLimits;

      // 1. Check monthly limit (from database - get fresh count)
      const monthlyStatus = await this.getMonthlyUsage(tenantId);
      if (monthlyStatus.used >= monthlyStatus.limit) {
        await this.logRateLimitViolation(tenantId, 'monthly', req);
        res.status(429).json({
          error: 'Monthly API request limit exceeded',
          code: 'MONTHLY_LIMIT_EXCEEDED',
          limit: monthlyStatus.limit,
          used: monthlyStatus.used,
          resetDate: await this.getMonthlyResetDate(tenantId)
        });
        return;
      }

      // 2. Check per-minute rate limit (from Redis)
      const tierLimit = this.tierLimits[tierName] || this.tierLimits.starter;
      const allowed = await this.checkRateLimit(
        tenantId,
        tierLimit.windowMs,
        tierLimit.maxRequests
      );

      if (!allowed.ok) {
        await this.logRateLimitViolation(tenantId, 'per_minute', req);
        res.status(tierLimit.statusCode || 429).json({
          error: tierLimit.message,
          code: 'RATE_LIMIT_EXCEEDED',
          limit: tierLimit.maxRequests,
          window: tierLimit.windowMs / 1000,
          retryAfter: allowed.retryAfter
        });
        return;
      }

      // 3. Set rate limit headers
      res.setHeader('X-RateLimit-Limit', tierLimit.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', allowed.remaining.toString());
      res.setHeader('X-RateLimit-Reset', allowed.resetTime.toString());

      // 4. Increment monthly counter asynchronously (don't wait)
      this.incrementMonthlyCounter(tenantId).catch(err =>
        console.error('Failed to increment monthly counter:', err)
      );

      // 5. Log API request for analytics
      this.logApiRequest(req).catch(err =>
        console.error('Failed to log API request:', err)
      );

      next();
    } catch (error) {
      console.error('Rate limit error:', error);
      // Fail open - allow request but log error
      next();
    }
  };

  /**
   * Check rate limit using Redis sliding window
   * Uses sorted sets for accurate sliding window algorithm
   */
  private async checkRateLimit(
    tenantId: string,
    windowMs: number,
    maxRequests: number
  ): Promise<{
    ok: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  }> {
    const key = `ratelimit:${tenantId}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Use Redis transaction for accuracy
      const multi = this.redis.multi();

      // Remove old entries outside the window
      multi.zremrangebyscore(key, 0, windowStart);

      // Count current requests in window
      multi.zcard(key);

      // Add current request
      multi.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiry to window duration
      multi.expire(key, Math.ceil(windowMs / 1000));

      const results = await multi.exec();

      if (!results) {
        throw new Error('Redis transaction failed');
      }

      // Get count before adding current request
      const count = results[1][1] as number;

      const remaining = Math.max(0, maxRequests - count - 1);
      const resetTime = now + windowMs;

      if (count >= maxRequests) {
        // Rate limit exceeded
        const retryAfter = Math.ceil(windowMs / 1000);
        return { ok: false, remaining: 0, resetTime, retryAfter };
      }

      return { ok: true, remaining, resetTime };
    } catch (error) {
      console.error('Redis rate limit error:', error);
      // Fail open on Redis errors
      return { ok: true, remaining: maxRequests, resetTime: now + windowMs };
    }
  }

  /**
   * Get monthly API usage from database
   */
  private async getMonthlyUsage(tenantId: string): Promise<{ used: number; limit: number }> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT t.api_calls_this_month as used, pt.max_api_calls_monthly as limit
        FROM tenants t
        JOIN pricing_tiers pt ON t.tier_id = pt.id
        WHERE t.id = $1`,
        [tenantId]
      );
      return result.rows[0] || { used: 0, limit: 10000 };
    } finally {
      client.release();
    }
  }

  /**
   * Increment monthly API request counter in database
   */
  private async incrementMonthlyCounter(tenantId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `UPDATE tenants
        SET api_calls_this_month = api_calls_this_month + 1
        WHERE id = $1`,
        [tenantId]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get monthly limit reset date
   */
  private async getMonthlyResetDate(tenantId: string): Promise<string> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT rate_limit_reset_at FROM tenants WHERE id = $1`,
        [tenantId]
      );
      return result.rows[0]?.rate_limit_reset_at || new Date().toISOString();
    } finally {
      client.release();
    }
  }

  /**
   * Log rate limit violation for monitoring
   */
  private async logRateLimitViolation(
    tenantId: string,
    violationType: string,
    req: Request
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO audit_logs (tenant_id, action, metadata, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5)`,
        [
          tenantId,
          'rate_limit.exceeded',
          JSON.stringify({
            type: violationType,
            endpoint: req.path,
            method: req.method
          }),
          req.ip,
          req.headers['user-agent']
        ]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Log API request for analytics
   */
  private async logApiRequest(req: Request): Promise<void> {
    if (!req.tenant) return;

    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO audit_logs (tenant_id, action, metadata, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5)`,
        [
          req.tenant.tenantId,
          'api.request',
          JSON.stringify({
            endpoint: req.path,
            method: req.method
          }),
          req.ip,
          req.headers['user-agent']
        ]
      );
    } catch (error) {
      // Ignore logging errors - table might not exist
      console.debug('Failed to log API request:', error);
    } finally {
      client.release();
    }
  }
}

// ============================================================================
// ENDPOINT-SPECIFIC RATE LIMITING
// ============================================================================

/**
 * Custom rate limiter for specific endpoints (e.g., authentication)
 * Can be more restrictive than tenant-level limits
 */
export class EndpointRateLimiter {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Create rate limiter for specific endpoint
   */
  create(config: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Use IP address as identifier for endpoint-specific limits
        const identifier = req.ip || 'unknown';
        const key = `ratelimit:endpoint:${req.path}:${identifier}`;
        const now = Date.now();
        const windowStart = now - config.windowMs;

        // Sliding window algorithm
        const multi = this.redis.multi();
        multi.zremrangebyscore(key, 0, windowStart);
        multi.zcard(key);
        multi.zadd(key, now, `${now}-${Math.random()}`);
        multi.expire(key, Math.ceil(config.windowMs / 1000));

        const results = await multi.exec();
        if (!results) {
          throw new Error('Redis transaction failed');
        }

        const count = results[1][1] as number;

        if (count >= config.maxRequests) {
          const retryAfter = Math.ceil(config.windowMs / 1000);
          res.setHeader('Retry-After', retryAfter.toString());
          res.status(config.statusCode || 429).json({
            error: config.message || 'Rate limit exceeded',
            code: 'ENDPOINT_RATE_LIMIT_EXCEEDED',
            retryAfter
          });
          return;
        }

        next();
      } catch (error) {
        console.error('Endpoint rate limit error:', error);
        // Fail open
        next();
      }
    };
  }
}

// ============================================================================
// IP-BASED RATE LIMITING (DDoS Protection)
// ============================================================================

/**
 * Global IP-based rate limiting for DDoS protection
 * Applied before authentication
 */
export class IPRateLimiter {
  private redis: Redis;
  private windowMs: number;
  private maxRequests: number;

  constructor(redis: Redis, windowMs: number = 60000, maxRequests: number = 1000) {
    this.redis = redis;
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  limit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ip = req.ip || 'unknown';
      const key = `ratelimit:ip:${ip}`;
      const now = Date.now();
      const windowStart = now - this.windowMs;

      const multi = this.redis.multi();
      multi.zremrangebyscore(key, 0, windowStart);
      multi.zcard(key);
      multi.zadd(key, now, `${now}-${Math.random()}`);
      multi.expire(key, Math.ceil(this.windowMs / 1000));

      const results = await multi.exec();
      if (!results) {
        throw new Error('Redis transaction failed');
      }

      const count = results[1][1] as number;

      if (count >= this.maxRequests) {
        const retryAfter = Math.ceil(this.windowMs / 1000);
        res.setHeader('Retry-After', retryAfter.toString());
        res.status(429).json({
          error: 'Too many requests from this IP',
          code: 'IP_RATE_LIMIT_EXCEEDED',
          retryAfter
        });
        return;
      }

      next();
    } catch (error) {
      console.error('IP rate limit error:', error);
      // Fail open
      next();
    }
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clear rate limit for a tenant (admin function)
 */
export async function clearTenantRateLimit(
  redis: Redis,
  tenantId: string
): Promise<void> {
  const key = `ratelimit:${tenantId}`;
  await redis.del(key);
}

/**
 * Get current rate limit status for a tenant
 */
export async function getTenantRateLimitStatus(
  redis: Redis,
  pool: Pool,
  tenantId: string
): Promise<{
  perMinuteCount: number;
  monthlyUsed: number;
  monthlyLimit: number;
  resetDate: string;
}> {
  // Get per-minute count from Redis
  const key = `ratelimit:${tenantId}`;
  const now = Date.now();
  const windowStart = now - 60000; // Last minute

  const perMinuteCount = await redis.zcount(key, windowStart, now);

  // Get monthly stats from database
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT api_requests_used, api_requests_limit, rate_limit_reset_at
      FROM tenants WHERE id = $1`,
      [tenantId]
    );

    const tenant = result.rows[0];
    return {
      perMinuteCount,
      monthlyUsed: tenant.api_requests_used,
      monthlyLimit: tenant.api_requests_limit,
      resetDate: tenant.rate_limit_reset_at
    };
  } finally {
    client.release();
  }
}

export default RateLimitMiddleware;

// ============================================================================
// AUTH RATE LIMITER - Stricter limits for login/signup
// ============================================================================

export class AuthRateLimiter {
  private redis: Redis;
  
  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Strict rate limiting for auth endpoints
   * 5 attempts per minute, 20 per hour per IP
   */
  limit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ip = req.ip || 'unknown';
      const now = Date.now();
      
      // Check per-minute limit (5 attempts)
      const minuteKey = `ratelimit:auth:minute:${ip}`;
      const minuteCount = await this.redis.incr(minuteKey);
      if (minuteCount === 1) {
        await this.redis.expire(minuteKey, 60);
      }
      
      if (minuteCount > 5) {
        res.status(429).json({
          error: 'Too many login attempts',
          message: 'Please wait a minute before trying again',
          retryAfter: 60
        });
        return;
      }
      
      // Check per-hour limit (20 attempts)
      const hourKey = `ratelimit:auth:hour:${ip}`;
      const hourCount = await this.redis.incr(hourKey);
      if (hourCount === 1) {
        await this.redis.expire(hourKey, 3600);
      }
      
      if (hourCount > 20) {
        res.status(429).json({
          error: 'Too many login attempts',
          message: 'Please wait an hour before trying again',
          retryAfter: 3600
        });
        return;
      }
      
      next();
    } catch (error) {
      console.error('[AuthRateLimiter] Error:', error);
      next(); // Fail open
    }
  };
}
