# Gemini Project: Hospitality SaaS Platform

## Project Overview

This is a multi-tenant hospitality AI platform for restaurants, street food vendors, and other hospitality businesses. It provides a comprehensive suite of tools to manage operations, including menus, orders, reservations, and customer data. The platform is built with a modern technology stack, leveraging a microservices-inspired architecture for scalability and maintainability.

**Key Technologies:**

*   **Backend:** Node.js with TypeScript and Express
*   **Database:** PostgreSQL 16 with Row-Level Security (RLS) for multi-tenancy
*   **Caching:** Redis 7
*   **Payments:** Stripe for subscription management and payment processing
*   **AI:**
    *   Qdrant for vector search (RAG)
    *   Integrations with various AI providers (OpenAI, Claude, Perplexity, etc.)
*   **Automation:** n8n for workflow automation
*   **Monitoring:** Grafana and Prometheus

**Architecture:**

The platform follows a multi-tenant architecture where each tenant's data is isolated using PostgreSQL's Row-Level Security (RLS). JWTs are used for authentication, with each token containing a `tenant_id` to ensure that users can only access data belonging to their organization. The backend is a Node.js/Express application written in TypeScript, and it connects to a PostgreSQL database for data persistence and Redis for caching and rate limiting.

## Building and Running

**1. Prerequisites:**

*   Node.js (>=18.0.0)
*   Docker and Docker Compose
*   `psql` command-line tool

**2. Setup:**

```bash
# 1. Copy the environment file
cp .env.example .env

# 2. Edit the .env file with your specific configuration
#    (database credentials, Stripe keys, JWT secret, etc.)

# 3. Start the infrastructure (PostgreSQL, Redis, etc.)
docker-compose up -d

# 4. Install project dependencies
npm install

# 5. Apply the database schema
npm run db:migrate
```

**3. Running the Application:**

```bash
# Start the development server with hot-reloading
npm run dev
```

The API will be available at `http://localhost:3000/api/v1`.

**4. Other Commands:**

```bash
# Build the project for production
npm run build

# Start the production server
npm run start

# Run tests
npm run test

# Lint the codebase
npm run lint
```

## Security & Multi-Tenancy

*   **Row-Level Security (RLS):** Data isolation is enforced at the database level using PostgreSQL RLS policies.
*   **Transaction Wrapper:** To ensure RLS works correctly with connection pooling, all service methods accessing tenant data **must** use the `runInTenantContext` helper. This wrapper checks out a client, sets the `app.current_tenant_id` session variable, and executes the callback within a transaction.
    ```typescript
    // Example
    import { runInTenantContext } from '../../lib/db-context';
    
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // client has RLS context applied
      return client.query('SELECT * FROM orders');
    });
    ```

## Development Conventions

*   **Code Style:** The project uses ESLint to enforce a consistent coding style. Run `npm run lint` to check for and fix any style issues.
*   **TypeScript:** The backend is written in TypeScript, and all new code should be strongly typed.
*   **Testing:** The project uses `jest` for testing (running via `npx jest`). All new features and bug fixes should be accompanied by tests.
    *   Run tests: `npm run test` (or `wsl npm run test` on Windows/WSL)
*   **Commits:** Commit messages should be clear and concise, and should describe the changes made.
*   **Database Migrations:** Database schema changes should be made in the `database/schema.sql` file and applied using `npm run db:migrate`.
