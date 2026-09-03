# Quick Start Guide

This guide starts the checked-in MitchAI prototype locally. It does not connect to or describe a public production service.

> **Project status:** MitchAI is a technical portfolio prototype. There is no public production service, API, or SLA. The project is not SOC 2 certified, GDPR has not been independently assessed, and any pricing found in fixtures or UI code is illustrative.

## Prerequisites

- Node.js 20 recommended; CI runs Node.js 20 and `package.json` permits Node.js 18 or newer
- npm
- Git
- Docker with Docker Compose

Check the tools:

```bash
node --version
npm --version
git --version
docker --version
docker compose version
```

## 1. Clone the repository

```bash
git clone https://github.com/Bogdan0708/MitchAI.git
cd MitchAI
```

## 2. Install backend dependencies

Use the checked-in lockfile:

```bash
npm ci
```

## 3. Configure the local environment

```bash
cp .env.example .env
```

Replace every required placeholder in `.env` before starting the API. At minimum, review the PostgreSQL password and connection URL, Redis URL, JWT secret, n8n credentials, Grafana password, and values required by whichever optional providers you intend to exercise. Do not commit local credentials.

The checked-in Compose configuration maps PostgreSQL to host port `5433` and Redis to host port `6380`, matching `.env.example`.

Generate development secrets with a secure random generator, for example:

```bash
openssl rand -hex 32
```

Cloud AI, Stripe, email, storage, and similar integrations require their own accounts and configuration. Ollama is optional and expects a separately available Ollama endpoint. n8n is configured as a Compose service, but no n8n workflow definitions are checked into this repository.

## 4. Start local infrastructure

Start the services needed by the backend:

```bash
docker compose up -d postgres redis

docker compose ps
```

Example `docker compose ps` shape (container IDs, ports, and timing vary):

```text
NAME                    SERVICE    STATUS
hospitality-postgres    postgres   Up (healthy)
hospitality-redis       redis      Up
```

Optional configured services can be started explicitly:

```bash
# Vector database and workflow-automation infrastructure
docker compose up -d qdrant n8n

# Optional monitoring profile
docker compose --profile monitoring up -d grafana
```

## 5. Initialize the database

For this Compose quick start, database initialization is automatic: the `postgres` service mounts `database/schema.sql` into `/docker-entrypoint-initdb.d/`, and the PostgreSQL image runs it only when creating a new, empty database volume. Do not also run the schema manually against that newly initialized volume.

The repository also exposes `npm run db:migrate`. That runner is a separate setup path for an empty database not already initialized by Compose: it executes `database/schema.sql`, then the ordered files under `database/migrations/`, and records them in `schema_migrations`. The current Compose configuration does not run those migration files, and combining both initialization paths against the same database can attempt to create existing schema objects.

Existing Compose volumes are not reinitialized when `database/schema.sql` changes. Review the migration runner and pending SQL migrations before updating an existing database; do not assume restarting the container reapplies them.

Example verification command:

```bash
docker compose exec postgres \
  psql -U hospitality_admin -d hospitality_db -c "\dt"
```

The resulting table list depends on the current schema and database state.

## 6. Start the backend

```bash
npm run dev
```

The Express API defaults to `http://localhost:3000` and mounts application routes under `http://localhost:3000/api/v1`.

Example startup output only—the exact messages and connection state vary:

```text
Server listening on port 3000
Redis connected successfully
```

## 7. Check local health

Basic process check:

```bash
curl http://localhost:3000/ping
```

Example response:

```text
pong
```

Database and Redis health check:

```bash
curl http://localhost:3000/api/v1/health
```

Example response shape only; the timestamp and status reflect the current run:

```json
{
  "status": "healthy",
  "timestamp": "2026-01-01T12:00:00.000Z",
  "services": {
    "database": "up",
    "redis": "up"
  }
}
```

A degraded or unavailable response means the local dependencies or environment need attention; it is not evidence about a hosted service.

## 8. Start the Next.js frontend

The primary frontend implementation is Next.js/React. In a second terminal, from the repository root:

```bash
cd frontend
npm ci
npm run dev -- -p 3001
```

Open `http://localhost:3001`. Port 3001 avoids the backend's default port 3000. Configure the frontend API URL for the local backend where required.

## Development checks

From the repository root:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Frontend production build:

```bash
cd frontend
npm ci
npm run build
```

The repository also defines Playwright frontend E2E scripts. Those tests may require browsers, running services, and suitable test configuration:

```bash
cd frontend
npm run test:e2e
```

## Common local commands

### Backend

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

`npm start` runs the previously compiled `dist/server.js`; run `npm run build` first.

### Docker Compose

```bash
docker compose ps
docker compose logs -f postgres redis
docker compose restart postgres redis
docker compose down
```

Removing volumes deletes local database and service data, so it is intentionally not part of the normal quick-start flow.

The existing destructive cleanup command is retained for reference. **WARNING: this permanently deletes the local Compose volumes and their data:**

```bash
docker-compose down -v
```

### Database and Redis

```bash
# PostgreSQL shell
docker compose exec postgres \
  psql -U hospitality_admin -d hospitality_db

# Redis ping
docker compose exec redis redis-cli ping

# WARNING: destructively clear every key in the local Redis database
docker exec hospitality-redis redis-cli FLUSHDB
```

## Troubleshooting

### Port already in use

The backend defaults to port 3000. Set a different backend port in `.env`, or start the frontend on another port as shown above.

The existing forced-stop command is retained for reference. Identify the process first; **WARNING: `kill -9` terminates it immediately without graceful cleanup:**

```bash
lsof -i :3000
kill -9 PID
```

### Database connection failed

```bash
docker compose ps postgres
docker compose logs postgres
docker compose exec postgres pg_isready -U hospitality_admin
```

Confirm `DATABASE_URL` uses host port `5433` when the backend runs directly on the host.

### Redis connection failed

```bash
docker compose ps redis
docker compose logs redis
docker compose exec redis redis-cli ping
```

Confirm `REDIS_URL` uses host port `6380` when the backend runs directly on the host.

### TypeScript or dependency errors

Reinstall exactly from the lockfile, then rerun the relevant check:

```bash
npm ci
npm run typecheck
npm run build
```

The existing clean-install command is retained for reference. **WARNING: it deletes installed dependencies and the checked-in lockfile before generating a new lockfile:**

```bash
rm -rf node_modules package-lock.json
npm install
```

## Setup checklist

- [ ] Node.js 20 is available (Node.js 18 is the declared package minimum)
- [ ] Repository cloned from `https://github.com/Bogdan0708/MitchAI.git`
- [ ] Backend dependencies installed with `npm ci`
- [ ] `.env` created locally and placeholder values reviewed
- [ ] PostgreSQL and Redis started
- [ ] Database schema initialized
- [ ] Backend started and local health endpoint checked
- [ ] Frontend dependencies installed and Next.js app started if needed
- [ ] Type check, lint, tests, and builds run for the areas being changed

For architecture and implemented-scope notes, see [README.md](README.md). For additional API details, see `docs/openapi.yaml` and the route implementations under `src/routes/`.
