/**
 * CSRF PROTECTION MIDDLEWARE
 *
 * Provides CSRF protection for state-changing requests.
 * For API-based authentication using Bearer tokens, this middleware
 * validates a custom header to prevent CSRF attacks.
 *
 * Implementation:
 * - Requires X-Requested-With header for all state-changing requests
 * - This header cannot be set by cross-origin requests without CORS preflight
 * - Combined with proper CORS configuration, prevents CSRF attacks
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Custom header name that must be present on state-changing requests
const CSRF_HEADER_NAME = 'x-requested-with';
const CSRF_HEADER_VALUE = 'XMLHttpRequest'; // Standard value used by AJAX libraries

// Methods that modify state and require CSRF protection
const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Paths that are exempt from CSRF protection
const EXEMPT_PATHS = [
  '/webhooks/stripe',     // Stripe webhooks use their own signature verification
  '/api/v1/auth/login',   // Login doesn't have a session yet
  '/api/v1/onboard',      // Public onboarding endpoint
  '/api/v1/health',       // Health check
];

/**
 * CSRF Protection Middleware
 *
 * Validates that state-changing requests include a custom header
 * that cannot be set by cross-origin requests without CORS approval.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF check for non-state-changing methods
  if (!STATE_CHANGING_METHODS.includes(req.method)) {
    return next();
  }

  // Skip exempt paths
  const isExempt = EXEMPT_PATHS.some(path =>
    req.path === path || req.path.startsWith(path)
  );
  if (isExempt) {
    return next();
  }

  // Check for custom header
  const requestedWith = req.headers[CSRF_HEADER_NAME];

  if (!requestedWith) {
    res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Missing required header: X-Requested-With',
      hint: 'Include header "X-Requested-With: XMLHttpRequest" in your request'
    });
    return;
  }

  // Validate header value (case-insensitive)
  if (requestedWith.toString().toLowerCase() !== CSRF_HEADER_VALUE.toLowerCase()) {
    res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Invalid X-Requested-With header value'
    });
    return;
  }

  next();
}

/**
 * Generate CSRF Token (for cookie-based sessions if needed)
 *
 * This is provided for future use if the application needs to support
 * cookie-based authentication in addition to Bearer tokens.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Cookie-based CSRF Middleware (for future use)
 *
 * If the application needs cookie-based CSRF protection,
 * this middleware can be used to set and validate CSRF tokens.
 */
export function cookieBasedCsrf(req: Request, res: Response, next: NextFunction): void {
  // Get or generate CSRF token
  let csrfToken = req.cookies?.['_csrf'];

  if (!csrfToken) {
    csrfToken = generateCsrfToken();
    res.cookie('_csrf', csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
  }

  // For GET requests, just set the token
  if (!STATE_CHANGING_METHODS.includes(req.method)) {
    // Make token available to templates/responses
    res.locals.csrfToken = csrfToken;
    return next();
  }

  // Validate token from header or body
  const submittedToken = req.headers['x-csrf-token'] || req.body?._csrf;

  if (!submittedToken || submittedToken !== csrfToken) {
    res.status(403).json({
      error: 'CSRF token validation failed',
      message: 'Invalid or missing CSRF token'
    });
    return;
  }

  next();
}

export default csrfProtection;
