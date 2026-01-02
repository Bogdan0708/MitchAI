# Testing Guide

## API Testing Examples

### 1. Tenant Onboarding

```bash
# Create a new tenant (restaurant)
curl -X POST http://localhost:3000/api/v1/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "The Golden Spoon",
    "slug": "golden-spoon",
    "contactEmail": "owner@goldenspoon.com",
    "contactPhone": "+1-555-0123",
    "adminFirstName": "John",
    "adminLastName": "Smith",
    "adminEmail": "john@goldenspoon.com",
    "adminPassword": "SecurePass123!",
    "pricingTier": "professional",
    "timezone": "America/New_York",
    "locale": "en-US",
    "firstLocation": {
      "name": "Main Location",
      "address": "123 Main St",
      "city": "New York",
      "state": "NY",
      "postalCode": "10001",
      "country": "US"
    }
  }'

# Expected Response:
# {
#   "success": true,
#   "tenant": {
#     "id": "uuid",
#     "slug": "golden-spoon"
#   },
#   "user": {
#     "id": "uuid"
#   },
#   "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "stripe": {
#     "customerId": "cus_xxx",
#     "subscriptionId": null
#   }
# }
```

### 2. Authentication

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@goldenspoon.com",
    "password": "SecurePass123!"
  }'

# Expected Response:
# {
#   "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "user": {
#     "id": "uuid",
#     "email": "john@goldenspoon.com",
#     "firstName": "John",
#     "lastName": "Smith",
#     "role": "owner"
#   },
#   "tenant": {
#     "id": "uuid",
#     "slug": "golden-spoon"
#   }
# }

# Save the access token for subsequent requests
export TOKEN="your-access-token-here"
```

### 3. Tenant Management

```bash
# Get tenant information
curl -X GET http://localhost:3000/api/v1/tenant \
  -H "Authorization: Bearer $TOKEN"

# Update tenant settings
curl -X PATCH http://localhost:3000/api/v1/tenant \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "The Golden Spoon Restaurant",
    "timezone": "America/Los_Angeles",
    "settings": {
      "currency": "USD",
      "taxRate": 8.875
    }
  }'
```

### 4. Location Management

```bash
# List all locations
curl -X GET http://localhost:3000/api/v1/locations \
  -H "Authorization: Bearer $TOKEN"

# Create a new location
curl -X POST http://localhost:3000/api/v1/locations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Downtown Branch",
    "slug": "downtown",
    "addressLine1": "456 Broadway",
    "city": "New York",
    "state": "NY",
    "postalCode": "10012",
    "country": "US",
    "phone": "+1-555-0456",
    "email": "downtown@goldenspoon.com",
    "operatingHours": {
      "monday": {"open": "11:00", "close": "22:00"},
      "tuesday": {"open": "11:00", "close": "22:00"},
      "wednesday": {"open": "11:00", "close": "22:00"},
      "thursday": {"open": "11:00", "close": "22:00"},
      "friday": {"open": "11:00", "close": "23:00"},
      "saturday": {"open": "10:00", "close": "23:00"},
      "sunday": {"open": "10:00", "close": "21:00"}
    }
  }'
```

### 5. Menu Management

```bash
# List menu items
curl -X GET http://localhost:3000/api/v1/menu \
  -H "Authorization: Bearer $TOKEN"

# Create menu item
curl -X POST http://localhost:3000/api/v1/menu \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "categoryId": "category-uuid",
    "name": "Classic Burger",
    "description": "Angus beef patty with lettuce, tomato, and special sauce",
    "price": 12.99,
    "sku": "BRG-001",
    "isAvailable": true,
    "calories": 650,
    "allergens": ["gluten", "dairy"],
    "imageUrl": "https://example.com/images/burger.jpg"
  }'
```

### 6. Order Processing

```bash
# List orders
curl -X GET "http://localhost:3000/api/v1/orders?status=pending&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# Create order
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "location-uuid",
    "orderNumber": "ORD-20240115-001",
    "orderType": "dine_in",
    "customerName": "Jane Doe",
    "customerEmail": "jane@example.com",
    "customerPhone": "+1-555-7890",
    "items": [
      {
        "menuItemId": "menu-item-uuid",
        "itemName": "Classic Burger",
        "quantity": 2,
        "unitPrice": 12.99,
        "totalPrice": 25.98
      },
      {
        "menuItemId": "menu-item-uuid-2",
        "itemName": "French Fries",
        "quantity": 1,
        "unitPrice": 4.99,
        "totalPrice": 4.99
      }
    ],
    "subtotal": 30.97,
    "taxAmount": 2.75,
    "tipAmount": 6.00,
    "discountAmount": 0
  }'
```

### 7. Reservations

```bash
# List reservations
curl -X GET "http://localhost:3000/api/v1/reservations?date=2024-01-20" \
  -H "Authorization: Bearer $TOKEN"

# Create reservation
curl -X POST http://localhost:3000/api/v1/reservations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "location-uuid",
    "customerName": "Bob Johnson",
    "customerEmail": "bob@example.com",
    "customerPhone": "+1-555-1122",
    "partySize": 4,
    "reservationDate": "2024-01-20",
    "reservationTime": "19:00",
    "specialRequests": "Window seat if possible, celebrating anniversary"
  }'
```

### 8. Data Export

```bash
# Request data export
curl -X POST http://localhost:3000/api/v1/tenant/export \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "exportType": "orders",
    "format": "csv",
    "dateRangeStart": "2024-01-01",
    "dateRangeEnd": "2024-01-31"
  }'

# Expected Response:
# {
#   "exportId": "export-uuid",
#   "status": "pending"
# }

# Check export status
curl -X GET http://localhost:3000/api/v1/tenant/export/export-uuid \
  -H "Authorization: Bearer $TOKEN"

# Expected Response (when completed):
# {
#   "exportId": "export-uuid",
#   "status": "completed",
#   "fileUrl": "https://s3.amazonaws.com/...",
#   "fileSize": 1048576,
#   "expiresAt": "2024-01-22T12:00:00Z"
# }
```

### 9. Rate Limit Testing

```bash
# Send multiple requests to test rate limiting
for i in {1..150}; do
  curl -X GET http://localhost:3000/api/v1/tenant \
    -H "Authorization: Bearer $TOKEN" \
    -w "\nRequest $i: Status %{http_code}\n"
  sleep 0.1
done

# Expected: First 100 succeed (Starter tier), then 429 responses
```

### 10. Health Check

```bash
# Check system health
curl -X GET http://localhost:3000/api/v1/health

# Expected Response:
# {
#   "status": "healthy",
#   "timestamp": "2024-01-15T12:00:00.000Z",
#   "services": {
#     "database": "up",
#     "redis": "up"
#   }
# }
```

## Load Testing with Apache Bench

```bash
# Test concurrent requests
ab -n 1000 -c 10 \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/tenant

# Test POST endpoint
ab -n 100 -c 5 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -p order.json \
  http://localhost:3000/api/v1/orders
```

## Database Testing

```sql
-- Connect to database
psql -U hospitality_admin -d hospitality_db

-- Check tenant isolation (should only see current tenant's data)
SET app.current_tenant_id = 'your-tenant-uuid';
SELECT * FROM orders;

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Monitor active connections
SELECT
  count(*) as connections,
  state,
  wait_event_type
FROM pg_stat_activity
WHERE datname = 'hospitality_db'
GROUP BY state, wait_event_type;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Redis Testing

```bash
# Connect to Redis
docker exec -it hospitality-redis redis-cli

# Check rate limit keys
KEYS ratelimit:*

# Check specific tenant rate limit
ZRANGE ratelimit:tenant-uuid 0 -1 WITHSCORES

# Monitor commands in real-time
MONITOR

# Check memory usage
INFO memory

# Check connected clients
CLIENT LIST
```

## Integration Testing Scenarios

### Scenario 1: Complete Tenant Lifecycle

```bash
#!/bin/bash

# 1. Create tenant
RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Test Restaurant",
    "slug": "test-restaurant-'$(date +%s)'",
    "contactEmail": "test@example.com",
    "adminFirstName": "Test",
    "adminLastName": "User",
    "adminEmail": "admin@test.com",
    "adminPassword": "TestPass123!",
    "pricingTier": "starter"
  }')

TOKEN=$(echo $RESPONSE | jq -r '.accessToken')
echo "Token: $TOKEN"

# 2. Create location
curl -s -X POST http://localhost:3000/api/v1/locations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Location",
    "slug": "main",
    "addressLine1": "123 Test St",
    "city": "Test City",
    "state": "TS",
    "postalCode": "12345",
    "country": "US"
  }'

# 3. Create menu items
curl -s -X POST http://localhost:3000/api/v1/menu \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Item",
    "price": 10.00,
    "isAvailable": true
  }'

# 4. Create order
curl -s -X POST http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderNumber": "TEST-001",
    "orderType": "dine_in",
    "items": [],
    "subtotal": 10.00,
    "taxAmount": 0.90,
    "tipAmount": 2.00,
    "discountAmount": 0
  }'

# 5. Request export
curl -s -X POST http://localhost:3000/api/v1/tenant/export \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "exportType": "full",
    "format": "json"
  }'

echo "Integration test completed!"
```

### Scenario 2: Rate Limit Validation

```bash
#!/bin/bash

TOKEN="your-token-here"
SUCCESS=0
RATE_LIMITED=0

for i in {1..150}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X GET http://localhost:3000/api/v1/tenant \
    -H "Authorization: Bearer $TOKEN")

  if [ "$STATUS" -eq 200 ]; then
    SUCCESS=$((SUCCESS + 1))
  elif [ "$STATUS" -eq 429 ]; then
    RATE_LIMITED=$((RATE_LIMITED + 1))
  fi
done

echo "Success: $SUCCESS"
echo "Rate Limited: $RATE_LIMITED"
echo "Expected for Starter tier: ~100 success, ~50 rate limited"
```

### Scenario 3: Multi-Tenant Isolation

```bash
#!/bin/bash

# Create two tenants
TENANT1_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/onboard \
  -H "Content-Type: application/json" \
  -d '{"businessName":"Tenant1",...}' | jq -r '.accessToken')

TENANT2_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/onboard \
  -H "Content-Type: application/json" \
  -d '{"businessName":"Tenant2",...}' | jq -r '.accessToken')

# Create order for Tenant 1
ORDER1=$(curl -s -X POST http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer $TENANT1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}' | jq -r '.id')

# Try to access Tenant 1's order with Tenant 2's token (should fail)
curl -s -X GET http://localhost:3000/api/v1/orders/$ORDER1 \
  -H "Authorization: Bearer $TENANT2_TOKEN"

# Expected: 404 or 403 (order not found due to RLS)
```

## Performance Benchmarks

Expected performance on modest hardware (4 CPU, 8GB RAM):

| Operation | Avg Response Time | P95 | P99 | Throughput |
|-----------|------------------|-----|-----|------------|
| GET /tenant | 15ms | 25ms | 40ms | 500 req/s |
| GET /orders | 20ms | 35ms | 60ms | 400 req/s |
| POST /orders | 50ms | 80ms | 120ms | 200 req/s |
| GET /menu | 10ms | 20ms | 30ms | 800 req/s |

## Troubleshooting Tests

```bash
# Check if services are running
docker-compose ps

# View API logs
docker-compose logs -f api

# Check database connectivity
docker exec hospitality-postgres pg_isready

# Check Redis connectivity
docker exec hospitality-redis redis-cli ping

# Restart services
docker-compose restart api

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
```

## Automated Testing with Jest

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tenant.test.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## Monitoring During Tests

```bash
# Monitor PostgreSQL queries
docker exec -it hospitality-postgres \
  psql -U hospitality_admin -d hospitality_db \
  -c "SELECT pid, now() - query_start as duration, query
      FROM pg_stat_activity
      WHERE state = 'active'
      ORDER BY duration DESC;"

# Monitor Redis operations
docker exec -it hospitality-redis redis-cli MONITOR

# Monitor Docker container resources
docker stats
```
