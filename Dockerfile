# ============================================================================
# MULTI-STAGE DOCKERFILE FOR NODE.JS API
# ============================================================================

# Stage 1: Base image with dependencies
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql-client

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Stage 2: Development dependencies
FROM base AS development
ENV NODE_ENV=development

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Stage 3: Builder
FROM development AS builder
ENV NODE_ENV=production

# Build TypeScript
RUN npm run build

# Stage 4: Production dependencies
FROM base AS production-deps
ENV NODE_ENV=production

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 5: Production image
FROM node:20-alpine AS production
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    postgresql-client \
    curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=production-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/healthcheck.js ./

# Create directories for exports and logs
RUN mkdir -p /app/exports /app/logs && \
    chown -R nodejs:nodejs /app/exports /app/logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node healthcheck.js || exit 1

# Start application
CMD ["node", "dist/server.js"]
