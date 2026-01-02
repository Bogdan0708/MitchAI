/**
 * Tenant Middleware Tests
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { TenantMiddleware, generateToken } from '../../middleware/tenant.middleware';
import { createMockRequest, createMockResponse, createMockNext } from '../setup';

describe('Tenant Middleware', () => {
  const mockPool = {
    query: jest.fn(),
  };
  const mockRedis = {
    get: jest.fn(),
    setex: jest.fn(),
    hincrby: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const payload = {
        tenantId: 'tenant-123',
        tenantSlug: 'test-restaurant',
        userId: 'user-123',
        userRole: 'owner',
        email: 'test@example.com',
      };

      const token = generateToken(payload, 'test-secret');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token
      const decoded = jwt.verify(token, 'test-secret') as Record<string, unknown>;
      expect(decoded.tenant_id).toBe(payload.tenantId);
      expect(decoded.sub).toBe(payload.userId);
    });

    it('should include expiration in token', () => {
      const payload = {
        tenantId: 'tenant-123',
        tenantSlug: 'test-restaurant',
        userId: 'user-123',
        userRole: 'owner',
        email: 'test@example.com',
      };

      const token = generateToken(payload, 'test-secret');
      const decoded = jwt.verify(token, 'test-secret') as Record<string, unknown>;

      expect(decoded.exp).toBeDefined();
    });
  });

  describe('tenantMiddleware', () => {
    it('should reject requests without authorization header', async () => {
      const req = createMockRequest() as unknown as Request;
      const res = createMockResponse() as unknown as Response;
      const next = createMockNext() as NextFunction;

      const middleware = new TenantMiddleware(mockPool as any, mockRedis as any, 'test-secret');
      await middleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });

    it('should reject requests with invalid token', async () => {
      const req = createMockRequest({
        headers: { authorization: 'Bearer invalid-token' },
      }) as unknown as Request;
      const res = createMockResponse() as unknown as Response;
      const next = createMockNext() as NextFunction;

      const middleware = new TenantMiddleware(mockPool as any, mockRedis as any, 'test-secret');
      await middleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should accept valid token and set tenant context', async () => {
      const payload = {
        tenantId: 'tenant-123',
        tenantSlug: 'test-restaurant',
        userId: 'user-123',
        userRole: 'owner',
        email: 'test@example.com',
      };

      const token = generateToken(payload, 'test-secret');

      // Mock database response
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'tenant-123',
          status: 'active',
          api_calls_this_month: 0,
          tier_name: 'professional',
          max_api_calls_monthly: 50000,
          rate_limit_per_minute: 500,
          features: { menu_ai: true },
        }],
      });

      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      }) as unknown as Request;
      const res = createMockResponse() as unknown as Response;
      const next = createMockNext() as NextFunction;

      const middleware = new TenantMiddleware(mockPool as any, mockRedis as any, 'test-secret');
      await middleware.authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect((req as any).tenant).toBeDefined();
      expect((req as any).tenant.tenantId).toBe('tenant-123');
    });

    it('should reject suspended tenants', async () => {
      const payload = {
        tenantId: 'tenant-123',
        tenantSlug: 'test-restaurant',
        userId: 'user-123',
        userRole: 'owner',
        email: 'test@example.com',
      };

      const token = generateToken(payload, 'test-secret');

      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'tenant-123',
          status: 'suspended',
          tier_name: 'professional',
          max_api_calls_monthly: 50000,
          rate_limit_per_minute: 500,
          features: { menu_ai: true },
        }],
      });

      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      }) as unknown as Request;
      const res = createMockResponse() as unknown as Response;
      const next = createMockNext() as NextFunction;

      const middleware = new TenantMiddleware(mockPool as any, mockRedis as any, 'test-secret');
      await middleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
