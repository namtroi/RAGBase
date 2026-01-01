# =============================================================================
# STAGE 1: Builder
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

# Install dependencies (cached unless lockfile changes)
RUN pnpm install --frozen-lockfile

# Copy prisma schema (needed for build)
COPY apps/backend/prisma ./apps/backend/prisma

# Copy source code
COPY apps/backend/src ./apps/backend/src
COPY apps/backend/tsconfig*.json ./apps/backend/

# Build TypeScript
RUN pnpm --filter @ragbase/backend build

# =============================================================================
# STAGE 2: Production
# =============================================================================
FROM node:20-slim AS production

WORKDIR /app

# Install pnpm for production
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json ./apps/backend/

# Copy production dependencies
ENV CI=true
RUN pnpm install --frozen-lockfile --prod

# Copy prisma schema for generation
COPY apps/backend/prisma ./apps/backend/prisma

# Generate Prisma client for production environment
RUN pnpm --filter @ragbase/backend db:generate

# Copy built artifacts from builder
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

ENV NODE_ENV=production
EXPOSE 3000

WORKDIR /app/apps/backend
CMD ["node", "dist/index.js"]
