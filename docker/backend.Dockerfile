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

# Copy all files
COPY . .

# Install all deps
RUN pnpm install

# Generate Prisma client
RUN pnpm --filter @ragbase/backend db:generate

# Build
RUN pnpm --filter @ragbase/backend build

# Production image
FROM node:20-slim

WORKDIR /app

# Copy everything from builder
COPY --from=builder /app ./

ENV NODE_ENV=production
EXPOSE 3000

# Run from the backend directory with tsx to support path aliases
WORKDIR /app/apps/backend
CMD ["npx", "tsx", "src/index.ts"]
