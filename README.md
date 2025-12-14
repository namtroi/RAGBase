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
- **Embedding:** fastembed (self-hosted, ONNX-based)
- **AI Worker:** Python 3.11 + Docling
- **Testing:** Vitest + Testcontainers

## Development Workflow

This project follows **Test-Driven Development (TDD)**:

1. Write tests FIRST (RED)
2. Implement minimum code (GREEN)
3. Refactor (REFACTOR)

See [docs/core/testing-strategy.md](docs/core/testing-strategy.md) for details.

## Phase 1 Implementation Status

- [x] **Phase 00:** Scaffold & Infrastructure - [Completion Report](plans/2025-12-13-phase1-tdd-implementation/completion/phase-00-complete.md)
- [x] **Phase 01:** Test Infrastructure - [Completion Report](plans/2025-12-13-phase1-tdd-implementation/completion/phase-01-complete.md)
- [x] **Phase 02:** Validation Layer (TDD) - [Completion Report](plans/2025-12-13-phase1-tdd-implementation/completion/phase-02-complete.md)
- [x] **Phase 03:** Business Logic (TDD) - [Completion Report](plans/2025-12-13-phase1-tdd-implementation/completion/phase-03-complete.md)
- [x] **Phase 04:** API Routes Integration (TDD) - [Completion Report](plans/2025-12-13-phase1-tdd-implementation/completion/phase-04-complete.md)
- [x] **Phase 05:** Queue & Callbacks (TDD) - [Completion Report](plans/2025-12-13-phase1-tdd-implementation/completion/phase-05-complete.md)
- [x] **Phase 06:** E2E Pipeline (TDD) - [Completion Report](plans/2025-12-13-phase1-tdd-implementation/completion/phase-06-complete.md)
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

📚 **[View Full Documentation Index](docs/README.md)**

### Quick Links
- [Project Overview](docs/core/project-overview-pdr.md) - What is SchemaForge?
- [System Architecture](docs/core/system-architecture.md) - Technical design
- [API Contracts](docs/core/api-contracts.md) - API specifications
- [Testing Strategy](docs/core/testing-strategy.md) - TDD approach
- [Project Roadmap](docs/core/project-roadmap.md) - Development phases
- [Code Standards](docs/core/code-standards.md) - Coding conventions

## License

MIT
