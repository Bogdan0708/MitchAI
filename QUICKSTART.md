# Quick Start Guide

Get your multi-tenant hospitality SaaS platform running in 10 minutes.

## Prerequisites Check

```bash
# Check Node.js (need 18+)
node --version

# Check Docker (need 20+)
docker --version

# Check Docker Compose (need 2.0+)
docker-compose --version

# Check Git
git --version
```

## 1. Clone or Setup Project (30 seconds)

```bash
# If cloning from Git
git clone https://github.com/yourusername/hospitality-saas.git
cd hospitality-saas

# Or if you have the files already
cd /home/godja/hospitality-saas
```

## 2. Install Dependencies (1 minute)

```bash
npm install
```

## 3. Configure Environment (1 minute)

```bash
# Copy environment template
cp .env.example .env

# Edit with your favorite editor
nano .env  # or vim, code, etc.
```

### Minimum Required Configuration

```env
# Database (use defaults for local development)
DATABASE_URL=postgres://hospitality_admin:changeme@localhost:5432/hospitality_db

# Redis (use default)
REDIS_URL=redis://localhost:6379

# JWT (generate a secure secret)
JWT_SECRET=your-super-secret-key-min-32-chars-change-this

# Stripe (get from https://stripe.com/docs/keys)
STRIPE_SECRET_KEY=sk_test_your_test_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# AWS S3 (for data exports)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET=your-bucket-name
```

### Quick JWT Secret Generator

```bash
# Generate a secure 32-character secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. Start Infrastructure (2 minutes)

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Wait for services to be healthy
docker-compose ps
```

You should see:
```
NAME                  STATUS
hospitality-postgres  Up (healthy)
hospitality-redis     Up (healthy)
```

## 5. Initialize Database (1 minute)

```bash
# Connect and run schema
docker exec -i hospitality-postgres psql -U hospitality_admin -d hospitality_db < database/schema.sql

# Verify tables created
docker exec hospitality-postgres psql -U hospitality_admin -d hospitality_db -c "\dt"
```

You should see all tables listed (tenants, orders, menu_items, etc.).

## 6. Start Application (30 seconds)

### Development Mode

```bash
npm run dev
```

You should see:
```
==========================================
  Hospitality SaaS Platform API
==========================================
Environment: development
Server: http://localhost:3000
API: http://localhost:3000/api/v1
Database: Connected ✓
Redis: Connected ✓
==========================================
```

### Production Mode (Docker)

```bash
# Build and start everything
docker-compose up -d

# View logs
docker-compose logs -f api
```

## 7. Test the API (2 minutes)

### Health Check

```bash
curl http://localhost:3000/api/v1/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "services": {
    "database": "up",
    "redis": "up"
  }
}
```

### Create Your First Tenant

```bash
curl -X POST http://localhost:3000/api/v1/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Test Restaurant",
    "slug": "test-restaurant",
    "contactEmail": "owner@test.com",
    "contactPhone": "+1-555-0123",
    "adminFirstName": "John",
    "adminLastName": "Doe",
    "adminEmail": "john@test.com",
    "adminPassword": "TestPass123!",
    "pricingTier": "starter",
    "timezone": "America/New_York"
  }'
```

Save the `accessToken` from the response!

### Make Your First API Call

```bash
# Set your token
export TOKEN="your-access-token-from-previous-step"

# Get tenant info
curl http://localhost:3000/api/v1/tenant \
  -H "Authorization: Bearer $TOKEN"
```

## 8. Access Management Tools (Optional)

### Adminer (Database UI)

```bash
# Start with development profile
docker-compose --profile development up -d

# Open in browser
http://localhost:8080

# Login credentials:
# System: PostgreSQL
# Server: postgres
# Username: hospitality_admin
# Password: changeme
# Database: hospitality_db
```

### Grafana (Monitoring)

```bash
# Start with monitoring profile
docker-compose --profile monitoring up -d

# Open in browser
http://localhost:3001

# Login credentials:
# Username: admin
# Password: admin (or your GRAFANA_PASSWORD from .env)
```

## Common Commands

### Development

```bash
# Start dev server with auto-reload
npm run dev

# Run tests (after creating test files)
npm test

# Lint code
npm run lint

# Build TypeScript
npm run build

# Run production build
npm start
```

### Docker

```bash
# View all services
docker-compose ps

# View logs
docker-compose logs -f api

# Restart a service
docker-compose restart api

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

### Database

```bash
# Connect to PostgreSQL
docker exec -it hospitality-postgres psql -U hospitality_admin -d hospitality_db

# Run a query
docker exec hospitality-postgres psql -U hospitality_admin -d hospitality_db -c "SELECT COUNT(*) FROM tenants"

# Backup database
docker exec hospitality-postgres pg_dump -U hospitality_admin hospitality_db > backup.sql

# Restore database
docker exec -i hospitality-postgres psql -U hospitality_admin hospitality_db < backup.sql
```

### Redis

```bash
# Connect to Redis
docker exec -it hospitality-redis redis-cli

# Check keys
docker exec hospitality-redis redis-cli KEYS "*"

# Clear all rate limits
docker exec hospitality-redis redis-cli FLUSHDB
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 3000
lsof -i :3000

# Kill the process (replace PID)
kill -9 PID

# Or change the port in .env
PORT=3001
```

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres

# Verify connection
docker exec hospitality-postgres pg_isready
```

### Redis Connection Failed

```bash
# Check if Redis is running
docker-compose ps redis

# Check logs
docker-compose logs redis

# Restart Redis
docker-compose restart redis

# Test connection
docker exec hospitality-redis redis-cli ping
```

### Module Not Found Error

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors

```bash
# Rebuild
npm run build

# Check TypeScript version
npx tsc --version
```

## Testing Your Setup

### Complete Test Script

Save as `test-setup.sh`:

```bash
#!/bin/bash

echo "Testing Hospitality SaaS Setup..."
echo "=================================="

# 1. Health Check
echo "1. Checking health endpoint..."
curl -s http://localhost:3000/api/v1/health | jq .

# 2. Create tenant
echo "2. Creating test tenant..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Test Restaurant",
    "slug": "test-'$(date +%s)'",
    "contactEmail": "test@example.com",
    "adminFirstName": "Test",
    "adminLastName": "User",
    "adminEmail": "admin@test.com",
    "adminPassword": "TestPass123!",
    "pricingTier": "starter"
  }')

TOKEN=$(echo $RESPONSE | jq -r '.accessToken')
echo "Token: $TOKEN"

# 3. Get tenant info
echo "3. Getting tenant info..."
curl -s http://localhost:3000/api/v1/tenant \
  -H "Authorization: Bearer $TOKEN" | jq .

# 4. Create location
echo "4. Creating location..."
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
  }' | jq .

# 5. List locations
echo "5. Listing locations..."
curl -s http://localhost:3000/api/v1/locations \
  -H "Authorization: Bearer $TOKEN" | jq .

echo "=================================="
echo "Setup test completed!"
```

Run it:
```bash
chmod +x test-setup.sh
./test-setup.sh
```

## Next Steps

### 1. Explore the API
- Read `TESTING.md` for comprehensive API examples
- Try creating orders, menu items, and reservations
- Test rate limiting by making many requests

### 2. Set Up Stripe
- Create a Stripe account at https://stripe.com
- Get your test API keys
- Set up webhook endpoint
- Test subscription creation

### 3. Configure AWS S3
- Create an S3 bucket
- Set up IAM credentials
- Test data export functionality

### 4. Review Documentation
- `README.md` - Complete feature documentation
- `ARCHITECTURE.md` - Design decisions and patterns
- `ARCHITECTURE_DIAGRAM.md` - Visual diagrams

### 5. Deploy to Production
- Set up a production environment
- Configure SSL certificates
- Enable monitoring
- Set up automated backups

## Development Workflow

### Day-to-Day Development

```bash
# 1. Start infrastructure (run once)
docker-compose up -d postgres redis

# 2. Start dev server (auto-reloads on changes)
npm run dev

# 3. Make changes to code

# 4. Test changes
curl http://localhost:3000/api/v1/...

# 5. View logs
tail -f logs/app.log
```

### Before Committing

```bash
# Lint code
npm run lint

# Run tests
npm test

# Build to check for errors
npm run build
```

## Production Deployment

### Quick Production Deploy

```bash
# 1. Set environment to production
export NODE_ENV=production

# 2. Build and start
docker-compose build
docker-compose up -d

# 3. Scale API servers
docker-compose up -d --scale api=3

# 4. Enable monitoring
docker-compose --profile monitoring up -d

# 5. Enable backups
docker-compose --profile backup up -d
```

## Getting Help

### Resources
- **Documentation**: See `README.md` and `ARCHITECTURE.md`
- **Testing Examples**: See `TESTING.md`
- **Architecture Diagrams**: See `ARCHITECTURE_DIAGRAM.md`
- **File Structure**: See `FILE_STRUCTURE.md`

### Check Logs
```bash
# API logs
docker-compose logs -f api

# Database logs
docker-compose logs -f postgres

# Redis logs
docker-compose logs -f redis

# All logs
docker-compose logs -f
```

### Verify Services
```bash
# Check all services
docker-compose ps

# Check specific service health
docker-compose exec api node healthcheck.js
```

## Success Checklist

- [ ] Node.js 18+ installed
- [ ] Docker and Docker Compose installed
- [ ] Dependencies installed (`npm install`)
- [ ] Environment configured (`.env` file)
- [ ] Infrastructure running (`docker-compose ps` shows healthy)
- [ ] Database initialized (tables created)
- [ ] Application started (dev or production)
- [ ] Health check passes (`/api/v1/health`)
- [ ] First tenant created successfully
- [ ] JWT token received
- [ ] Protected endpoints accessible with token

## You're Ready!

Your multi-tenant SaaS platform is now running. You have:

- Complete database schema with Row-Level Security
- JWT authentication with tenant context
- Rate limiting (per-minute and monthly)
- Stripe integration ready
- Data export capabilities
- Docker orchestration
- Comprehensive API

Start building your hospitality business platform!

For more details, see:
- API documentation: `README.md`
- Architecture details: `ARCHITECTURE.md`
- Testing guide: `TESTING.md`
