# =============================================================================
# STAGE 1: Builder — install deps + generate Prisma client
# =============================================================================
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV CI=true

# Copy lockfiles first for layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json ./apps/backend/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy prisma schema and generate client
COPY apps/backend/prisma ./apps/backend/prisma
RUN pnpm --filter @ragbase/backend db:generate

# Copy source code and config
COPY apps/backend/src ./apps/backend/src
COPY apps/backend/tsconfig*.json apps/backend/prisma.config.ts ./apps/backend/

# =============================================================================
# STAGE 2: Production — slim image, no build tools
# =============================================================================
FROM node:20-slim

WORKDIR /app

# Install only runtime dependency (curl for health checks)
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm (needed for npx prisma / tsx)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files and installed node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend ./apps/backend
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

ENV NODE_ENV=production
EXPOSE 3000

WORKDIR /app/apps/backend

# Create uploads directory and set permissions for named volume initialization
RUN mkdir -p /tmp/uploads && chown -R node:node /tmp/uploads

# Run as non-root user
USER node

# Safe migration was attempted but breaks existing db push environments without a manual baseline.
# Reverting to db push to restore functionality.
CMD ["sh", "-c", "npx prisma db push && npx tsx src/index.ts"]
