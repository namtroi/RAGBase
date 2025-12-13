# SchemaForge

**The "Set & Forget" Data Pipeline for Enterprise RAG**

Open Source | Self-Hosted | Structure-Aware | Prisma Powered

## Quick Start

### Prerequisites
- Node.js 20 LTS
- pnpm 9+
- Docker & Docker Compose
- PostgreSQL 16+ (via Docker)

### Development Setup

1. **Install dependencies:**
```bash
pnpm install
```

2. **Set up environment:**
```bash
cp .env.example .env
# Edit .env and set your API_KEY
```

3. **Start services:**
```bash
docker compose up -d
```

4. **Run migrations:**
```bash
pnpm --filter @schemaforge/backend db:push
```

5. **Start development server:**
```bash
pnpm dev
```

6. **Verify health:**
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok"}
```

## Project Structure

```
schemaforge/
├── apps/
│   ├── backend/           # Node.js Fastify API
│   └── ai-worker/         # Python FastAPI (Phase 07)
├── tests/                 # Test suites (Phase 01)
├── docker/                # Dockerfiles
├── docs/                  # Documentation
└── plans/                 # Implementation plans
```

## Tech Stack

- **Backend:** Node.js 20 + Fastify + TypeScript
- **Database:** PostgreSQL 16 + pgvector
- **Queue:** BullMQ + Redis
- **Embedding:** @xenova/transformers (self-hosted)
- **AI Worker:** Python 3.11 + Docling
- **Testing:** Vitest + Testcontainers

## Development Workflow

This project follows **Test-Driven Development (TDD)**:

1. Write tests FIRST (RED)
2. Implement minimum code (GREEN)
3. Refactor (REFACTOR)

See [docs/TEST_STRATEGY.md](docs/TEST_STRATEGY.md) for details.

## Phase 1 Implementation Status

- [x] **Phase 00:** Scaffold & Infrastructure
- [ ] **Phase 01:** Test Infrastructure
- [ ] **Phase 02:** Validation Layer (TDD)
- [ ] **Phase 03:** Business Logic (TDD)
- [ ] **Phase 04:** API Routes Integration (TDD)
- [ ] **Phase 05:** Queue & Callbacks (TDD)
- [ ] **Phase 06:** E2E Pipeline (TDD)
- [ ] **Phase 07:** Python AI Worker
- [ ] **Phase 08:** Frontend UI
- [ ] **Phase 09:** Production Readiness

## Available Commands

```bash
# Development
pnpm dev                    # Start all services in watch mode
pnpm build                  # Build all packages

# Testing
pnpm test                   # Run all tests
pnpm test:unit              # Run unit tests only
pnpm test:integration       # Run integration tests

# Database
pnpm --filter @schemaforge/backend db:generate  # Generate Prisma client
pnpm --filter @schemaforge/backend db:push      # Push schema to DB
pnpm --filter @schemaforge/backend db:migrate   # Create migration

# Linting
pnpm lint                   # Type-check all packages
```

## Docker Services

- **backend:** Node.js API (port 3000)
- **ai-worker:** Python worker (internal)
- **postgres:** PostgreSQL 16 + pgvector (port 5432)
- **redis:** Redis 7 (port 6379)

## Environment Variables

See [.env.example](.env.example) for all configuration options.

## Documentation

- [OVERVIEW.md](docs/OVERVIEW.md) - Project overview
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Technical architecture
- [CONTRACT.md](docs/CONTRACT.md) - API contracts
- [TEST_STRATEGY.md](docs/TEST_STRATEGY.md) - Testing approach
- [ROADMAP.md](docs/ROADMAP.md) - Development roadmap

## License

MIT
