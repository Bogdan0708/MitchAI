# Mitch AI Suite

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-20-green?style=for-the-badge&logo=node.js)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)

**A multi-tenant hospitality software prototype with AI-assisted workflows**

[Status](#project-status) • [Implemented Scope](#implemented-scope) • [Architecture](#architecture) • [Quick Start](#quick-start) • [API](#local-api) • [Testing](#testing)

</div>

---

## Project status

> **Technical portfolio prototype**
>
> - This repository demonstrates a hospitality platform architecture and checked-in application code; it is not presented as a public production service.
> - There is no public production API or public SLA for this project.
> - The project is **not SOC 2 certified**.
> - GDPR readiness or compliance has **not been independently assessed**. Data-export and tenant-isolation code should not be interpreted as certification or legal assurance.
> - Any prices or tiers represented in application fixtures, database configuration, or UI screens are **illustrative**, not a public commercial offer.

## Overview

Mitch AI Suite explores a multi-tenant hospitality application for menus, orders, reservations, reviews, content, analytics, and AI-assisted tasks. The primary implementation is a Node.js/TypeScript/Express backend, a Next.js frontend, and PostgreSQL persistence.

The repository contains substantial prototype code, but individual modules may require external services, credentials, infrastructure, and further validation before they can be used end to end. Claims below describe checked-in implementation rather than a hosted-service commitment.

## Implemented scope

Checked-in code includes:

- Express routes, controllers, validation, authentication, tenant context, and rate limiting.
- PostgreSQL schema and migrations for the multi-tenant data model.
- Service modules for menus, orders, reservations, reviews, content, compliance records, analytics, billing, data export, and AI orchestration.
- A Next.js dashboard with pages and components for core hospitality and AI workflows.
- Provider adapters for cloud AI services and local model endpoints, including an Ollama provider.
- Docker Compose configuration for PostgreSQL, Redis, Qdrant, n8n, and optional Grafana infrastructure.
- Jest-based backend tests and a CI workflow for type checking, linting, tests, backend builds, and frontend builds.

Some integrations need provider accounts and environment configuration. The Compose file configures an n8n service, but this repository does not include n8n workflow definitions; n8n should therefore be treated as configured integration infrastructure rather than a delivered automation library. Ollama is an optional local-model integration and requires a separately running Ollama service and model.

## Security and privacy posture

The codebase contains security-oriented implementation such as tenant middleware, role information, PostgreSQL Row-Level Security definitions, request validation, rate limiting, security headers, audit-related services, and data-export functionality. These controls are implementation evidence only. They do not establish production hardening, complete isolation, regulatory compliance, or third-party certification.

## Architecture

```text
Browser
  |
  v
Next.js 14 / React frontend
  |
  v
Node.js 20 / TypeScript / Express API
  |----------------------|---------------------|
  v                      v                     v
PostgreSQL 16          Redis 7           AI provider adapters
(primary data)    (cache/rate limits)   (cloud and local/Ollama)

Configured local integration infrastructure:
- Qdrant for vector storage
- n8n for workflow automation infrastructure
- Grafana via the optional monitoring profile
```

### Primary stack

| Layer | Checked-in implementation |
|---|---|
| Backend | Node.js, TypeScript, Express |
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Database | PostgreSQL 16 schema, migrations, and `pg` client |
| Supporting services | Redis, Qdrant, n8n, optional Grafana via Docker Compose |
| AI | Provider orchestration and adapters, including optional Ollama |
| Testing | Jest/ts-jest backend tests; Playwright configuration/scripts for frontend E2E work |

## Quick start

### Prerequisites

- Node.js 20 recommended (CI uses Node.js 20; `package.json` declares Node.js 18 or newer)
- npm
- Git
- Docker with Docker Compose for local infrastructure

### Installation

```bash
git clone https://github.com/Bogdan0708/MitchAI.git
cd MitchAI

npm ci
cp .env.example .env
# Replace placeholder values in .env before starting the API.

docker compose up -d postgres redis
npm run dev
```

The backend defaults to `http://localhost:3000`. See [QUICKSTART.md](QUICKSTART.md) for database initialization, frontend startup, and example health-check output.

### Frontend

In a second terminal:

```bash
cd MitchAI/frontend
npm ci
npm run dev -- -p 3001
```

This uses port 3001 to avoid conflicting with the backend's default port. Configure the frontend's API URL for your local environment where required.

## Local API

The Express app mounts application routes at:

```text
http://localhost:3000/api/v1
```

Useful local endpoints include:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/ping` | Basic process check |
| `GET` | `/health` | Database and Redis health check |
| `GET` | `/api/v1/health` | API-level database and Redis health check |
| `POST` | `/api/v1/onboard` | Prototype tenant onboarding |
| `POST` | `/api/v1/auth/login` | Authentication |
| `GET` | `/api/v1/ai/health` | Authenticated AI-provider health check |
| `GET` | `/api/v1/ai/models` | Authenticated configured-model listing |
| `POST` | `/api/v1/ai/review-response` | Authenticated review-response generation |
| `POST` | `/api/v1/ai/menu-description` | Authenticated menu-description generation |
| `POST` | `/api/v1/ai/content` | Authenticated content generation |

Most application routes require a bearer token and tenant context. Availability also depends on the database schema, Redis, and any relevant provider configuration. No public production base URL is advertised.

### Example health request

```bash
curl http://localhost:3000/api/v1/health
```

Example response shape (values vary by run):

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

## Testing

Install dependencies first with `npm ci`, then run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Build the frontend separately:

```bash
cd frontend
npm ci
npm run build
```

Test totals can change as the repository evolves; use the current command output rather than a fixed count in this document.

## Project structure

```text
MitchAI/
├── src/                    # Express API, services, middleware, routes, and tests
├── frontend/               # Next.js application
├── database/               # PostgreSQL schema, migrations, and seed data
├── docs/                   # Additional technical documentation
├── scripts/                # Database and project scripts
├── docker-compose.yml      # Local supporting services
├── package.json            # Backend scripts and dependencies
└── QUICKSTART.md           # Local setup guide
```

## License

**Proprietary** - © 2024-2025 Mitch from Transylvania Ltd.

All rights reserved. Unauthorized copying, modification, or distribution is prohibited.
