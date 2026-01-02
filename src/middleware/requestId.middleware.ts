/**
 * REQUEST ID MIDDLEWARE
 *
 * Generates unique request IDs for tracking and logging purposes.
 * The ID is attached to the request object and included in responses.
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Extend Express Request type to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      requestTime: Date;
    }
  }
}

/**
 * Middleware that assigns a unique ID to each request.
 * - Uses X-Request-ID header if provided (for distributed tracing)
 * - Generates a new UUID if not provided
 * - Sets response header for client reference
 */
export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Use existing request ID from header (forwarded from load balancer/proxy)
  // or generate a new one
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();

  // Attach to request object
  req.requestId = requestId;
  req.requestTime = new Date();

  // Set response header for client reference
  res.setHeader('X-Request-ID', requestId);

  next();
};

/**
 * Get request context for logging
 */
export const getRequestContext = (req: Request): Record<string, any> => {
  return {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
    tenantId: (req as any).tenant?.tenantId,
    userId: (req as any).tenant?.userId,
    timestamp: req.requestTime?.toISOString()
  };
};
