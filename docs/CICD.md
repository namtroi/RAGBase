# CI/CD & Automation Testing

**Platform:** GitHub Actions | **Coverage:** 79%

---

## 🔄 Workflows

### 1. Backend Tests (`backend-tests.yml`)

**Triggers:** Push to `main`, `mvp/e2e`, `develop`

**Jobs:**
- **Unit Tests** (~5 min) - Validation + Business Logic
- **Integration Tests** (~10 min) - Real PostgreSQL + Redis
- **E2E Tests** (~15 min) - Full pipeline with Testcontainers

---

### 2. AI Worker Tests (`ai-worker-tests.yml`)

**Triggers:** Changes to `apps/ai-worker/**`

**Jobs:**
- **Pytest** (~8 min) - 713 test lines, 70% coverage threshold

---

### 3. Docker Build (`docker-build.yml`)

**Triggers:** Push to `main`, `mvp/e2e`

**Jobs:**
- Build backend + AI worker images
- Trivy security scan

---

### 4. Lint (`lint.yml`)

**Triggers:** All pushes

**Jobs:**
- ESLint + TypeScript + Ruff/Black

---

## 🚀 Local Testing

### Quick (5 min)
```bash
pnpm --filter @ragbase/backend test:unit
cd apps/ai-worker && pytest
```

### Full (30 min)
```bash
docker-compose up -d
pnpm --filter @ragbase/backend test:unit
pnpm --filter @ragbase/backend test:integration
pnpm --filter @ragbase/backend test:e2e
cd apps/ai-worker && pytest --cov=src
pnpm lint && pnpm type-check
```

---

## 🔒 Security

**Safe to push:** Code, tests, configs (`.env.example`), docs, workflows  
**NEVER push:** `.env`, API keys, passwords, `uploads/`, database dumps

**Protection:** `.gitignore` configured ✅

---

## 🔧 Troubleshooting

**Unit tests fail:** Check test isolation  
**Integration tests fail:** Run `pnpm db:push`, check Redis  
**E2E tests fail:** Check AI Worker logs, Testcontainers timeout  
**Local ≠ CI:** Verify env vars, service versions, parallel execution

---

## 📈 Performance

| Workflow | Duration |
|----------|----------|
| Unit | ~5 min |
| Integration | ~10 min |
| E2E | ~15 min |
| AI Worker | ~8 min |
| Docker Build | ~10 min |
| Lint | ~3 min |

**Total:** ~30 min (parallel)

---

**See also:** [TESTING.md](./TESTING.md) | [ARCHITECTURE.md](./ARCHITECTURE.md)
