/**
 * Rate Limit Middleware Tests
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimitMiddleware } from '../../middleware/rateLimit.middleware';
import { createMockRequest, createMockResponse, createMockNext } from '../setup';

describe('Rate Limit Middleware', () => {
  let mockRedis: any;
  const mockPool: any = { connect: jest.fn(), query: jest.fn() };

  beforeEach(() => {
    mockRedis = {
      multi: jest.fn(() => ({
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 0], [null, 0], [null, 0], [null, 0]])
      })),
      zcount: jest.fn().mockResolvedValue(0)
    };
    jest.clearAllMocks();
  });

  it('should allow requests under rate limit', async () => {
    const middleware = new RateLimitMiddleware(mockRedis as any, mockPool as any);
    middleware['getMonthlyUsage'] = jest.fn().mockResolvedValue({ used: 0, limit: 1000 });
    middleware['incrementMonthlyCounter'] = jest.fn().mockResolvedValue(undefined);
    middleware['logApiRequest'] = jest.fn().mockResolvedValue(undefined);

    const req = createMockRequest({
      tenant: {
        tenantId: 'tenant-123',
        tier: {
          name: 'professional',
          apiCallsLimit: 50000,
        },
      },
      ip: '127.0.0.1',
    }) as unknown as Request;
    const res = createMockResponse() as unknown as Response;
    const next = createMockNext() as NextFunction;

    await middleware.limit(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String));
  });

  it('should block requests over rate limit', async () => {
    mockRedis.multi = jest.fn(() => ({
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([[null, 1000], [null, 1000], [null, 0], [null, 0]])
    }));

    const middleware = new RateLimitMiddleware(mockRedis as any, mockPool as any);
    middleware['getMonthlyUsage'] = jest.fn().mockResolvedValue({ used: 0, limit: 10 });
    middleware['logRateLimitViolation'] = jest.fn().mockResolvedValue(undefined);

    const req = createMockRequest({
      tenant: {
        tenantId: 'tenant-123',
        tier: {
          name: 'starter',
          apiCallsLimit: 10000,
        },
      },
      ip: '127.0.0.1',
    }) as unknown as Request;
    const res = createMockResponse() as unknown as Response;
    const next = createMockNext() as NextFunction;

    await middleware.limit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'RATE_LIMIT_EXCEEDED',
        error: 'Rate limit exceeded for Starter tier'
      })
    );
  });

  it('should use different limits for different tiers', async () => {
    // Test starter tier
    const starterReq = createMockRequest({
      tenant: {
        tenantId: 'tenant-starter',
        tier: { name: 'starter', apiCallsLimit: 10000 },
      },
      ip: '127.0.0.1',
    }) as unknown as Request;
    const res1 = createMockResponse() as unknown as Response;

    const middleware = new RateLimitMiddleware(mockRedis as any, mockPool as any);
    middleware['getMonthlyUsage'] = jest.fn().mockResolvedValue({ used: 0, limit: 1000 });
    middleware['incrementMonthlyCounter'] = jest.fn().mockResolvedValue(undefined);
    middleware['logApiRequest'] = jest.fn().mockResolvedValue(undefined);
    await middleware.limit(starterReq, res1, createMockNext() as NextFunction);

    expect(res1.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String));

    // Test enterprise tier
    const enterpriseReq = createMockRequest({
      tenant: {
        tenantId: 'tenant-enterprise',
        tier: { name: 'enterprise', apiCallsLimit: 1000000 },
      },
      ip: '127.0.0.2',
    }) as unknown as Request;
    const res2 = createMockResponse() as unknown as Response;

    await middleware.limit(enterpriseReq, res2, createMockNext() as NextFunction);

    expect(res2.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String));
  });

  it('should handle requests without tenant context by returning 401', async () => {
    const req = createMockRequest({
      ip: '127.0.0.1',
    }) as unknown as Request;
    const res = createMockResponse() as unknown as Response;
    const next = createMockNext() as NextFunction;

    const middleware = new RateLimitMiddleware(mockRedis as any, mockPool as any);
    middleware['getMonthlyUsage'] = jest.fn().mockResolvedValue({ used: 0, limit: 1000 });
    middleware['incrementMonthlyCounter'] = jest.fn().mockResolvedValue(undefined);
    middleware['logApiRequest'] = jest.fn().mockResolvedValue(undefined);
    await middleware.limit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should set rate limit headers', async () => {
    const req = createMockRequest({
      tenant: {
        tenantId: 'tenant-123',
        tier: { name: 'professional', apiCallsLimit: 50000 },
      },
      ip: '127.0.0.1',
    }) as unknown as Request;
    const res = createMockResponse() as unknown as Response;
    const next = createMockNext() as NextFunction;

    const middleware = new RateLimitMiddleware(mockRedis as any, mockPool as any);
    middleware['getMonthlyUsage'] = jest.fn().mockResolvedValue({ used: 0, limit: 1000 });
    middleware['incrementMonthlyCounter'] = jest.fn().mockResolvedValue(undefined);
    middleware['logApiRequest'] = jest.fn().mockResolvedValue(undefined);
    await middleware.limit(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
  });
});
