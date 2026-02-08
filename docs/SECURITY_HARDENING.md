# Security Hardening Plan

**Created:** 2026-02-08
**Priority:** HIGH

## Current Security Posture

### ✅ Already Implemented
- [x] Sentry error monitoring with tenant context
- [x] Helmet security headers
- [x] CORS with strict origin validation
- [x] CSRF protection (X-Requested-With header)
- [x] Auth rate limiting (5/min, 20/hour per IP)
- [x] JWT authentication with 7-day expiry
- [x] Password requirements (12+ chars, complexity)
- [x] Secrets Manager for credentials (no hardcoded secrets)
- [x] Database backups (7-day retention, deletion protection)
- [x] HTTPS enforced via ALB/Amplify
- [x] AWS WAF on Amplify frontend
- [x] Row-Level Security (RLS) on tenant data

### 🔴 Critical Issues

#### 1. Next.js CVEs (CRITICAL)
**Current:** 14.2.21
**Impact:** SSRF, Authorization Bypass, DoS, Content Injection

```bash
cd frontend
npm install next@14.2.35
```

#### 2. AWS SDK Vulnerabilities (HIGH)
**Issue:** fast-xml-parser RangeError DoS
**Affected:** @aws-sdk/client-s3, @aws-sdk/client-sso, etc.

```bash
cd /home/godja/hospitality-saas
npm update @aws-sdk/client-s3 @aws-sdk/client-ses
```

#### 3. ESLint Plugin Vulnerabilities (HIGH)
**Issue:** glob command injection
**Affected:** eslint-config-next

```bash
cd frontend
npm install eslint-config-next@latest
```

---

## Recommended Improvements

### Priority 1: Fix Vulnerabilities

```bash
# Backend
cd /home/godja/hospitality-saas
npm audit fix

# Frontend
cd frontend
npm audit fix
npm install next@14.2.35
```

### Priority 2: Security Headers Enhancement

Add to `server.ts` helmet config:

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Needed for Next.js
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.mitchfromtransylvania.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));
```

### Priority 3: API Rate Limiting

Add general API rate limiting (not just auth):

```typescript
// In rateLimit.middleware.ts
export const apiRateLimiter = new IPRateLimiter({
  windowMs: 60 * 1000,    // 1 minute
  max: 100,               // 100 requests per minute
  keyPrefix: 'api:',
});
```

### Priority 4: Input Validation

Install and configure Zod for request validation:

```bash
npm install zod
```

Example usage:
```typescript
import { z } from 'zod';

const CreateOrderSchema = z.object({
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().positive().max(100),
  })).min(1).max(50),
  notes: z.string().max(500).optional(),
});

// In route handler
const validated = CreateOrderSchema.safeParse(req.body);
if (!validated.success) {
  return res.status(400).json({ error: validated.error.issues });
}
```

### Priority 5: Audit Logging

Create `src/services/audit.service.ts`:

```typescript
interface AuditEvent {
  action: string;
  userId?: string;
  tenantId?: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

async function logAuditEvent(event: AuditEvent): Promise<void> {
  await pool.query(`
    INSERT INTO audit_logs (action, user_id, tenant_id, resource_type, resource_id, details, ip_address, user_agent, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
  `, [event.action, event.userId, event.tenantId, event.resourceType, event.resourceId, event.details, event.ip, event.userAgent]);
}
```

### Priority 6: Two-Factor Authentication (2FA)

For admin accounts:
1. Add `totp_secret` column to users table
2. Implement TOTP verification with `speakeasy` package
3. Require 2FA for billing changes, user management

### Priority 7: Dependency Scanning

Add to CI/CD:

```yaml
# .github/workflows/security.yml
name: Security Scan
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
      - run: cd frontend && npm audit --audit-level=high
```

---

## Database Security

### Current
- [x] Connection string in Secrets Manager
- [x] SSL required in production
- [x] RLS for tenant isolation

### Recommended
- [ ] Encrypt sensitive columns (PII) with AWS KMS
- [ ] Add connection pooling via PgBouncer
- [ ] Regular backup testing (restore drills)

---

## Action Items

1. **TODAY:** Fix Next.js critical vulnerabilities
2. **TODAY:** Run `npm audit fix` on both projects
3. **THIS WEEK:** Add general API rate limiting
4. **THIS WEEK:** Enhance helmet security headers
5. **NEXT WEEK:** Implement input validation with Zod
6. **NEXT WEEK:** Add audit logging table and service
7. **LATER:** 2FA for admin accounts
8. **LATER:** GitHub Dependabot alerts

---

## Security Contacts

- **AWS Security:** AWS support ticket
- **Vulnerability Reports:** security@mitchfromtransylvania.com (set up)
- **Incident Response:** Bogdan (owner)
