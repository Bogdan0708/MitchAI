# Multi-Tenant SaaS Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Multi-Tenancy Strategy](#multi-tenancy-strategy)
3. [Database Design](#database-design)
4. [Authentication & Authorization](#authentication--authorization)
5. [Rate Limiting](#rate-limiting)
6. [Billing Integration](#billing-integration)
7. [Data Export & Backup](#data-export--backup)
8. [Scaling Strategy](#scaling-strategy)
9. [Security Considerations](#security-considerations)

## Overview

This is a production-ready multi-tenant SaaS platform designed for hospitality businesses. The architecture prioritizes:

- **Tenant Isolation**: Complete data separation between tenants
- **Scalability**: Horizontal and vertical scaling capabilities
- **Security**: Multiple layers of protection
- **Performance**: Optimized queries and caching
- **Compliance**: GDPR and data portability support

## Multi-Tenancy Strategy

### Hybrid Approach: Shared Schema + Row-Level Security

We use a **hybrid multi-tenancy model** that combines:
1. Shared database schema (cost-effective)
2. PostgreSQL Row-Level Security (data isolation)
3. Tenant context via JWT tokens

#### Why This Approach?

**Advantages:**
- Lower infrastructure costs (shared resources)
- Easier schema migrations (one schema to manage)
- Better resource utilization
- Guaranteed data isolation via RLS

**Trade-offs:**
- Slightly more complex query patterns
- Requires careful RLS policy management
- All tenants share database resources

#### Alternative Approaches Considered

1. **Schema-per-tenant**: Separate schema for each tenant
   - Pros: Complete isolation, easier to move tenants
   - Cons: High maintenance, expensive, migration complexity

2. **Database-per-tenant**: Separate database for each tenant
   - Pros: Maximum isolation, dedicated resources
   - Cons: Very expensive, high operational overhead

3. **Shared schema without RLS**: Application-level filtering
   - Pros: Simpler implementation
   - Cons: Higher risk of data leakage, no database-level guarantee

## Database Design

### Row-Level Security Implementation

```sql
-- Enable RLS on all tenant tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create isolation policy
CREATE POLICY tenant_isolation_policy ON orders
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### Setting Tenant Context

The middleware sets the tenant context for each request:

```typescript
await client.query(
  `SET LOCAL app.current_tenant_id = $1`,
  [tenantId]
);
```

This ensures all subsequent queries are automatically filtered by tenant.

### Key Design Patterns

1. **Tenant ID in Every Table**: All tenant-scoped tables include `tenant_id`
2. **Soft Deletes**: Use `deleted_at` timestamp for data recovery
3. **Audit Logging**: Track all significant actions
4. **Optimistic Locking**: Use `updated_at` for conflict detection

### Index Strategy

```sql
-- Composite indexes for common queries
CREATE INDEX idx_orders_tenant_location_created
  ON orders(tenant_id, location_id, created_at DESC);

-- Partial indexes for active records
CREATE INDEX idx_menu_items_available
  ON menu_items(tenant_id, category_id)
  WHERE is_available = true AND deleted_at IS NULL;
```

## Authentication & Authorization

### JWT Token Structure

```json
{
  "tenantId": "uuid",
  "tenantSlug": "restaurant-name",
  "userId": "uuid",
  "userRole": "owner",
  "email": "user@example.com",
  "iat": 1234567890,
  "exp": 1234999999
}
```

### Authentication Flow

1. User submits credentials
2. Verify password (bcrypt)
3. Query tenant status
4. Generate JWT with tenant context
5. Return token

### Authorization Levels

- **Owner**: Full access to tenant resources
- **Manager**: Manage operations, limited admin
- **Staff**: Day-to-day operations
- **Viewer**: Read-only access

### Security Features

- Account lockout (5 failed attempts → 15 min lock)
- Password hashing (bcrypt, 10 rounds)
- JWT expiration (7 days)
- Token refresh mechanism
- IP address logging

## Rate Limiting

### Three-Tier Rate Limiting

1. **Global IP Rate Limit**: 1000 requests/minute per IP
   - DDoS protection
   - Applied before authentication

2. **Per-Tenant Per-Minute**: Based on pricing tier
   - Starter: 100/min
   - Professional: 500/min
   - Enterprise: 2000/min

3. **Monthly API Quota**: Based on pricing tier
   - Tracked in database
   - Reset monthly
   - Enforced by middleware

### Implementation: Sliding Window Algorithm

```typescript
const key = `ratelimit:${tenantId}`;
const now = Date.now();
const windowStart = now - windowMs;

// Redis sorted set for accurate sliding window
multi.zremrangebyscore(key, 0, windowStart);  // Remove old entries
multi.zcard(key);                              // Count current requests
multi.zadd(key, now, `${now}-${Math.random()}`); // Add current request
multi.expire(key, Math.ceil(windowMs / 1000)); // Set TTL
```

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1234567890
```

## Billing Integration

### Stripe Integration Points

1. **Customer Creation**: When tenant signs up
2. **Subscription Management**: Tier upgrades/downgrades
3. **Payment Processing**: Automated charging
4. **Webhook Handling**: Status updates

### Webhook Events Handled

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### Subscription States

```
trialing → active → past_due → canceled
          ↓
       suspended
```

### Pricing Tier Enforcement

```typescript
// Check limits before allowing operation
if (location_count >= max_locations) {
  throw new Error('Location limit exceeded for your tier');
}
```

## Data Export & Backup

### Export Types

1. **Full Export**: All tenant data (all tables)
2. **Orders Export**: Transaction history
3. **Menu Export**: Menu items and categories
4. **Customers Export**: Customer contact info
5. **Reservations Export**: Booking history

### Export Formats

- **JSON**: Structured data with relationships
- **CSV**: Flat format for spreadsheets
- **SQL**: Database dump for migration

### Export Workflow

1. User requests export (API call)
2. Create export record (status: pending)
3. Background worker processes export
4. Generate files (JSON/CSV/SQL)
5. Upload to S3
6. Update record (status: completed, file_url)
7. Send notification email
8. Auto-delete after 7 days

### Automated Backups

- Daily PostgreSQL dumps
- Compressed with gzip
- 30-day retention
- Optional S3 upload
- Integrity verification

```bash
# Run daily via cron
0 2 * * * /app/scripts/backup.sh
```

## Scaling Strategy

### Horizontal Scaling

**API Servers:**
```bash
docker-compose up -d --scale api=3
```

Use NGINX load balancer:
```nginx
upstream api_backend {
    server api-1:3000;
    server api-2:3000;
    server api-3:3000;
}
```

**Background Workers:**
- Multiple workers process jobs from Redis queue
- Each worker pulls jobs independently
- No coordination needed

### Vertical Scaling

**PostgreSQL:**
- Increase shared_buffers (25% of RAM)
- Increase effective_cache_size (50-75% of RAM)
- Tune work_mem for complex queries

**Redis:**
- Increase maxmemory
- Use Redis Cluster for distributed caching
- Consider read replicas

### Database Scaling

1. **Read Replicas**: Direct read queries to replicas
2. **Connection Pooling**: Use PgBouncer
3. **Partitioning**: Partition large tables by tenant_id
4. **Sharding**: Ultimate solution for extreme scale

### Caching Strategy

1. **Redis Cache**: Tenant metadata, pricing configs
2. **Application Cache**: Menu items, location data
3. **HTTP Cache**: Static assets, API responses

## Security Considerations

### Defense in Depth

1. **Network Layer**: NGINX reverse proxy, SSL/TLS
2. **Application Layer**: JWT, rate limiting, CORS
3. **Database Layer**: RLS, parameterized queries
4. **Data Layer**: Encryption at rest, backups

### SQL Injection Prevention

```typescript
// Always use parameterized queries
await pool.query(
  'SELECT * FROM orders WHERE tenant_id = $1',
  [tenantId]  // Properly escaped
);
```

### XSS Prevention

- Helmet.js for security headers
- Content Security Policy
- Input validation and sanitization

### CSRF Protection

- SameSite cookies
- CSRF tokens for mutations
- Origin header validation

### Data Encryption

- **In Transit**: TLS 1.3 for all connections
- **At Rest**: PostgreSQL encryption, S3 encryption
- **Secrets**: Environment variables, never in code

### Audit Logging

Track all sensitive operations:
- User login/logout
- Data exports
- Settings changes
- Rate limit violations
- Payment events

### Compliance

**GDPR:**
- Data export functionality
- Right to be forgotten (soft deletes)
- Audit trail
- Data processing agreements

**PCI DSS:**
- Never store payment details
- Use Stripe for payment processing
- Secure token handling

## Monitoring & Observability

### Metrics to Track

1. **Application Metrics**:
   - Request rate, latency, error rate
   - Endpoint performance
   - API quota usage

2. **Infrastructure Metrics**:
   - CPU, memory, disk usage
   - Database connections
   - Redis memory usage

3. **Business Metrics**:
   - New tenant signups
   - Active tenants
   - Revenue (MRR, ARR)
   - Churn rate

### Health Checks

```javascript
GET /api/v1/health

{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00Z",
  "services": {
    "database": "up",
    "redis": "up"
  }
}
```

### Error Tracking

- Use Sentry for error tracking
- Log levels: error, warn, info, debug
- Structured logging with JSON

### Alerting

Set up alerts for:
- High error rates (> 1%)
- Slow response times (> 500ms p95)
- Database connection exhaustion
- Redis memory usage (> 80%)
- Failed payments

## Performance Optimization

### Database Optimization

1. **Query Optimization**:
   - Use EXPLAIN ANALYZE
   - Add appropriate indexes
   - Avoid N+1 queries

2. **Connection Pooling**:
   - Reuse connections
   - Configure pool size (2-10 per instance)

3. **Prepared Statements**:
   - Reduce query parsing overhead
   - Better query plan caching

### API Optimization

1. **Pagination**: Limit result sets
2. **Field Selection**: Return only needed fields
3. **Compression**: gzip responses
4. **HTTP Caching**: Set appropriate headers

### Redis Optimization

1. **Key Expiration**: Set TTL on all keys
2. **Memory Eviction**: Use allkeys-lru policy
3. **Connection Pooling**: Reuse connections

## Disaster Recovery

### Backup Strategy

- **Frequency**: Daily automated backups
- **Retention**: 30 days
- **Location**: Local + S3
- **Testing**: Quarterly restore tests

### Recovery Procedures

1. **Data Corruption**: Restore from latest backup
2. **Accidental Deletion**: Recover from soft deletes
3. **Region Failure**: Failover to backup region
4. **Complete Loss**: Restore from S3 backups

### RTO/RPO Targets

- **Recovery Time Objective (RTO)**: 4 hours
- **Recovery Point Objective (RPO)**: 24 hours

## Future Enhancements

1. **Multi-region Deployment**: Active-active across regions
2. **Advanced Analytics**: Real-time dashboards
3. **Machine Learning**: Demand forecasting, pricing optimization
4. **Event Sourcing**: Complete audit trail
5. **GraphQL API**: More flexible queries
6. **WebSocket Support**: Real-time updates
7. **Mobile Apps**: Native iOS/Android apps
8. **Integration Marketplace**: Third-party integrations
