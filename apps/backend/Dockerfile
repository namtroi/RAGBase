# =============================================================================
# RAGBase Backend — Single-stage with tsx (handles @/ path aliases)
# =============================================================================
FROM node:20-slim

WORKDIR /app

# Install build dependencies for native modules + curl for health checks
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
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
COPY apps/backend/tsconfig*.json ./apps/backend/

ENV NODE_ENV=production
EXPOSE 3000

WORKDIR /app/apps/backend

# Entrypoint: push schema then start
CMD ["sh", "-c", "npx prisma db push --url \"$DATABASE_URL\" && npx tsx src/index.ts"]

