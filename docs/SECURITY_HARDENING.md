# Security Hardening Status

**Created:** 2026-02-08  
**Last Updated:** 2026-02-09  
**Status:** ✅ Core security complete

---

## Current Security Posture

### ✅ Implemented - Core Security

| Feature | Status | Details |
|---------|--------|---------|
| Sentry error monitoring | ✅ | Captures 5xx with tenant context |
| Helmet security headers | ✅ | Full CSP, HSTS preload, all headers |
| CORS strict validation | ✅ | Origin allowlist, credentials |
| CSRF protection | ✅ | X-Requested-With header required |
| Auth rate limiting | ✅ | 5/min, 20/hr per IP |
| AI rate limiting | ✅ | 3 tiers: standard/batch/heavy |
| JWT authentication | ✅ | 7-day expiry, secure cookies |
| Password policy | ✅ | 12+ chars, uppercase, lowercase, number, special |
| Secrets Manager | ✅ | All credentials in AWS Secrets Manager |
| Database backups | ✅ | 7-day retention, deletion protection |
| HTTPS enforced | ✅ | ALB + Amplify SSL termination |
| AWS WAF | ✅ | Frontend protection via Amplify |
| Row-Level Security | ✅ | Tenant isolation on all data tables |
| Zod input validation | ✅ | 13+ endpoints with schema validation |
| Audit logging | ✅ | Full service + table with GDPR support |

### ✅ Implemented - Rate Limiting Details

```
Auth Endpoints:
  /onboard, /auth/login    → 5/min, 20/hr per IP

AI Endpoints:
  Standard (30/min): /review-response, /sentiment, /translate
  Batch (10/min):    /menu-description/batch
  Heavy (5/min):     /menu-description, /content, /chat
```

### ✅ Implemented - Helmet Configuration

```typescript
// server.ts - Current config
helmet({
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
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [], // production only
    },
  },
  crossOriginEmbedderPolicy: true, // production only
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  dnsPrefetchControl: { allow: false },
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
})
```

### ✅ Implemented - Audit Service

Location: `src/services/audit.service.ts`

Features:
- Categorized actions (auth, user, tenant, data, integrations, security)
- Entity tracking with old/new values
- Sensitive field redaction (password, token, secret, api_key)
- GDPR compliance (data export/deletion tracking)
- Query API for tenant audit logs

---

## Vulnerabilities Fixed (2026-02-08)

| Issue | Severity | Fix |
|-------|----------|-----|
| Next.js SSRF (CVE-2024-51479) | Critical | Updated 14.2.21 → 14.2.35 |
| Next.js Auth Bypass (CVE-2024-56337) | Critical | Updated 14.2.21 → 14.2.35 |
| Backend npm vulns (22 high) | High | npm audit fix --force |
| Frontend npm vulns (1 critical) | Critical | npm audit fix |

---

## Remaining Vulnerabilities (Low Priority)

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| vitest vulns (4) | Moderate | Deferred | Dev dependency only |
| Next.js DoS (4) | High | Monitoring | Lower risk than auth bypass |

---

## Additional Security Features

### ✅ Two-Factor Authentication (2FA)

**Status:** Implemented  
**Location:** `src/services/twofa.service.ts`, `src/routes/twofa.routes.ts`

Features:
- TOTP-based authentication (RFC 6238)
- QR code generation for authenticator apps
- Backup codes (8 codes, single-use)
- Password verification required to disable

Endpoints:
- `GET /api/v1/2fa/status` - Check if 2FA enabled
- `POST /api/v1/2fa/setup` - Generate QR code + backup codes
- `POST /api/v1/2fa/verify-setup` - Verify token to enable 2FA
- `POST /api/v1/2fa/disable` - Disable 2FA (requires password)
- `POST /api/v1/2fa/backup-codes` - Regenerate backup codes

**⚠️ Action Required:** Run migration `003_add_2fa_columns.sql` on production database.

### ✅ GitHub Dependabot

**Status:** Configured  
**Location:** `.github/dependabot.yml`

- Weekly updates (Monday 9 AM London time)
- Backend + Frontend separate configs
- Groups AWS SDK and TypeScript updates
- Ignores major version bumps for core packages (manual review)

### ✅ CI Security Scanning

**Status:** Configured  
**Location:** `.github/workflows/security.yml`

- NPM audit on push/PR (high severity threshold)
- CodeQL static analysis (JavaScript/TypeScript)
- TruffleHog secret scanning
- Weekly scheduled scan (Sundays)

### Future Database Enhancements

| Item | Status | Priority |
|------|--------|----------|
| PII column encryption (AWS KMS) | Not started | Low |
| Connection pooling (PgBouncer) | Not started | Low |
| Backup restore drills | Not started | Medium |

---

## Security Contacts

- **Incident Response:** Bogdan (owner)
- **Vulnerability Reports:** security@mitchfromtransylvania.com (to set up)
- **AWS Support:** Via AWS console

---

## Change Log

| Date | Change |
|------|--------|
| 2026-02-09 | Verified 2FA, Dependabot, CI scanning all implemented |
| 2026-02-09 | Updated to reflect actual implementation status |
| 2026-02-08 | Fixed npm vulnerabilities, Next.js CVEs |
| 2026-02-08 | Added AI rate limiting (3 tiers) |
| 2026-02-08 | Initial security audit and roadmap |
