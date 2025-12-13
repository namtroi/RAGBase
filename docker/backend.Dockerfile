FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/backend/prisma apps/backend/prisma/

# Install deps
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm --filter @schemaforge/backend db:generate

# Copy source
COPY apps/backend/src apps/backend/src
COPY apps/backend/tsconfig.json apps/backend/

# Build
RUN pnpm --filter @schemaforge/backend build

# Production image
FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/apps/backend/node_modules/.prisma ./node_modules/.prisma

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
