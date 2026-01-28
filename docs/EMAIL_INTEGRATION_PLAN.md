# Email Integration Plan

## Overview

Porting Gmail Automation components to hospitality-saas for tenant email management.

**Source:** `C:\Dev\G-mail_Automation`  
**Target:** `src/services/email/`

## What Exists vs What We're Adding

| Current (email.service.ts) | New (Gmail Integration) |
|---------------------------|------------------------|
| Outbound transactional emails | Inbound email processing |
| SendGrid provider | Gmail API multi-account |
| Template-based sending | AI priority scoring |
| - | AI draft generation |
| - | Rules-based notifications |

## Components to Port

### Phase 1: Core Gmail Client
```
src/services/email/
├── gmail-client.ts       # Gmail API wrapper (per-tenant account)
├── gmail-auth.ts         # OAuth flow for connecting Gmail
├── types.ts              # Email types and interfaces
└── index.ts              # Module exports
```

### Phase 2: AI Email Features
```
src/services/email/
├── priority-scorer.ts    # AI-based email priority (0-1)
├── draft-generator.ts    # AI reply draft generation
└── email-processor.ts    # Orchestrates scoring + drafts
```

### Phase 3: Notifications & Automation
```
src/services/email/
├── notification-rules.ts # Rules engine for alerts
├── email-scheduler.ts    # Sync jobs, SLA monitoring
└── email-analytics.ts    # Email communication metrics
```

## Database Migrations

### 006_add_tenant_email_accounts.sql
- `tenant_email_accounts` - Gmail/Outlook connections per tenant
- OAuth tokens, refresh handling, connection status

### 007_add_email_tracking.sql
- `tracked_emails` - Inbound emails with priority scores
- `email_drafts` - AI-generated draft replies
- `email_notifications` - Notification history

## API Endpoints

```
POST   /api/email/connect           # Start OAuth flow
GET    /api/email/callback          # OAuth callback
GET    /api/email/accounts          # List connected accounts
DELETE /api/email/accounts/:id      # Disconnect account

GET    /api/email/inbox             # Fetch recent emails
GET    /api/email/inbox/:id         # Single email details
POST   /api/email/inbox/:id/draft   # Generate AI draft
POST   /api/email/inbox/:id/send    # Send reply

GET    /api/email/analytics         # Email metrics
```

## Integration Points

1. **AI Orchestrator** - Use existing `src/services/ai/orchestrator.ts` for LLM calls
2. **MTC Credits** - Deduct credits for AI email features
3. **Tenant Context** - All operations scoped to tenant
4. **Feature Flags** - Gate email features behind flags

## Priority Scoring Algorithm (from Gmail Automation)

```typescript
// Weighted average of factors
priority = (
  importance * 0.30 +    // Gmail IMPORTANT/STARRED labels
  senderScore * 0.25 +   // Domain reputation, known contacts
  keywordScore * 0.25 +  // Urgent/finance/legal in subject
  recencyScore * 0.20    // Newer = higher
);
```

## Start Order

1. ✅ Create plan (this file)
2. ✅ Types and interfaces (`src/services/email/types.ts`)
3. ✅ Gmail client (`src/services/email/gmail-client.ts`)
4. ✅ Database migration (`database/migrations/006_add_tenant_email_integration.sql`)
5. ✅ Priority scorer (`src/services/email/priority-scorer.ts`)
6. ✅ Draft generator (`src/services/email/draft-generator.ts`)
7. [ ] API routes
8. [ ] Tests

## Files Created

```
src/services/email/
├── types.ts           # 6.8KB - All email types and interfaces
├── gmail-client.ts    # 17.7KB - Gmail API wrapper with OAuth
├── priority-scorer.ts # 11.3KB - AI priority scoring
├── draft-generator.ts # 12.3KB - AI draft generation
└── index.ts           # 0.7KB - Module exports

database/migrations/
└── 006_add_tenant_email_integration.sql  # 14KB - Tables + RLS + helpers
```

## Next Steps

- [ ] API routes for email endpoints
- [ ] Tests for email services
- [ ] Frontend components (connect account, inbox view)
