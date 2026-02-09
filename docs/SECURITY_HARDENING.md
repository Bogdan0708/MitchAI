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

## Remaining Security Work

### Priority 1: Two-Factor Authentication (2FA)

**Status:** Not started  
**Target:** Admin accounts

Implementation plan:
1. Add `totp_secret`, `totp_enabled` columns to `tenant_users`
2. Install `speakeasy` or `otpauth` package
3. Create `/auth/2fa/setup` and `/auth/2fa/verify` endpoints
4. Require 2FA for:
   - Billing/subscription changes
   - User role changes
   - API key management

### Priority 2: GitHub Dependabot

**Status:** Not configured

Add `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
```

### Priority 3: CI Security Scanning

**Status:** Not configured

Add `.github/workflows/security.yml`:
```yaml
name: Security Scan
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm audit --audit-level=high
      - name: Frontend audit
        run: cd frontend && npm ci && npm audit --audit-level=high
```

### Priority 4: Database Enhancements

| Item | Status | Priority |
|------|--------|----------|
| PII column encryption (AWS KMS) | Not started | Medium |
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
| 2026-02-09 | Updated to reflect actual implementation status |
| 2026-02-08 | Fixed npm vulnerabilities, Next.js CVEs |
| 2026-02-08 | Added AI rate limiting (3 tiers) |
| 2026-02-08 | Initial security audit and roadmap |
