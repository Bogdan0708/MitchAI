import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { Redis } from 'ioredis'; // Import Redis
import jwt, { type SignOptions, type Secret } from 'jsonwebtoken';

interface JWTPayload {
  sub: string;
  tenant_id: string;
  email: string;
  role: 'owner' | 'admin' | 'manager' | 'staff';
}

interface TenantContext {
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
}

export interface TokenPayload {
  tenantId: string;
  tenantSlug?: string;
  userId: string;
  userRole: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request { tenant?: TenantContext; }
  }
}

export class TenantMiddleware {
  private jwtSecret: string;
  private TENANT_CACHE_TTL_SECONDS = 60; // Cache tenant data for 60 seconds

  constructor(private pool: Pool, private redis: Redis, jwtSecret: string) {
    this.jwtSecret = jwtSecret;
  }

  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing Authorization header' });
        return;
      }

      const token = authHeader.substring(7);
      let payload: JWTPayload;

      try {
        payload = jwt.verify(token, this.jwtSecret) as JWTPayload;
      } catch {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      const tenantId = payload.tenant_id;
      const cacheKey = `tenant:config:${tenantId}`;
      let tenant;

      // Try to get tenant from cache
      const cachedTenant = await this.redis.get(cacheKey);
      if (cachedTenant) {
        tenant = JSON.parse(cachedTenant);
      } else {
        // If not in cache, query database
        const result = await this.pool.query(`
          SELECT t.id, t.status, t.api_calls_this_month,
                 pt.name as tier_name, pt.max_api_calls_monthly,
                 pt.rate_limit_per_minute, pt.features
          FROM tenants t
          JOIN pricing_tiers pt ON t.tier_id = pt.id
          WHERE t.id = $1
        `, [tenantId]);

        if (result.rows.length === 0) {
          res.status(403).json({ error: 'Tenant not found' });
          return;
        }
        tenant = result.rows[0];
        await this.redis.setex(cacheKey, this.TENANT_CACHE_TTL_SECONDS, JSON.stringify(tenant));
      }

      if (tenant.status === 'suspended') {
        res.status(403).json({ error: 'Account suspended' });
        return;
      }

      req.tenant = {
        tenantId: payload.tenant_id,
        userId: payload.sub,
        userEmail: payload.email,
        userRole: payload.role,
        tier: {
          name: tenant.tier_name,
          maxApiCalls: tenant.max_api_calls_monthly,
          rateLimitPerMinute: tenant.rate_limit_per_minute,
          features: tenant.features
        }
      };

      // Increment API counter in Redis
      await this.redis.hincrby(`tenant:api_calls:${payload.tenant_id}`, 'monthly_count', 1);

      next();
    } catch (error) {
      console.error('Auth error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  };

  requireFeature = (feature: string) => (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tenant?.tier.features[feature]) {
      res.status(403).json({
        error: 'Feature not available',
        message: `Upgrade to access ${feature}`,
        currentTier: req.tenant?.tier.name
      });
      return;
    }
    next();
  };

  requireRole = (...roles: string[]) => (req: Request, res: Response, next: NextFunction): void => {
    if (!roles.includes(req.tenant?.userRole || '')) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export { TenantContext };

export const generateToken = (payload: TokenPayload, jwtSecret: string, expiresIn: SignOptions['expiresIn'] = '7d'): string => {
  return jwt.sign(
    {
      sub: payload.userId,
      tenant_id: payload.tenantId,
      tenant_slug: payload.tenantSlug,
      email: payload.email,
      role: payload.userRole
    },
    jwtSecret as Secret,
    { expiresIn }
  );
};
