# Contributing to RAGBase

Welcome! We are thrilled that you want to contribute. RAGBase is a "High Standards, Open Hearts" project. We value technical excellence, test-driven development, and kindness.

---

## 🚀 Getting Started

1.  **Prerequisites**:
    *   Node.js 20+ & pnpm 9+
    *   Python 3.11+
    *   Docker & Docker Compose

2.  **Setup**:
    ```bash
    git clone https://github.com/yourusername/ragbase.git
    cd ragbase
    pnpm install
    cp .env.example .env
    ```

3.  **Start Dev Environment**:
    ```bash
    docker compose up -d
    pnpm dev
    ```

---

## 🛠 Development Workflow

### 1. Branching
*   **Format**: `type/short-description`
*   **Examples**:
    *   `feat/qdrant-integration`
    *   `fix/pdf-parsing-error`
    *   `docs/update-readme`

### 2. Committing
We follow [Conventional Commits](https://www.conventionalcommits.org/):
*   `feat:` New feature
*   `fix:` Bug fix
*   `docs:` Documentation only
*   `test:` Adding or correcting tests
*   `chore:` Build process, dependency updates

### 3. Pull Requests
*   **Title**: Descriptive and clear (e.g., "feat: Add hybrid search with RRF").
*   **Content**: Link to the Linear/Jira/Issue ticket.
*   **Requirement**: All PRs must pass CI (Lint + Tests) before merging.

---

## 📏 Coding Standards

### General "Golden Rule"
**No code without tests.** If it's not tested, it doesn't exist.

### Backend (Node.js/TypeScript)
*   **Strict Types**: No `any`. Seriously.
*   **Validation**: Use Zod for all inputs.
*   **Errors**: Throw typed domain errors, not generic `Error`.

### AI Worker (Python)
*   **Type Hints**: Required for all function arguments and returns.
*   **Docstrings**: Google style docstrings for complex logic.
*   **Error Boundaries**: Catch specific exceptions, never bare `except:`.

### Frontend (React)
*   **Composition**: Small, focused components over mega-components.
*   **Tailwind**: Use utility classes; avoid custom CSS unless necessary.
*   **State**: Prefer React Query for server state, Context for global UI state.

---

## 🧪 Testing

We practice **TDD**. Write the test *before* the implementation.

### Commands
```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run specific test file
pnpm test apps/backend/tests/my-test.spec.ts
```

### Locations
*   **Unit Tests**: Co-located or in `tests/` folders.
*   **E2E Tests**: `apps/backend/tests/e2e/`.

---

## 📂 Project Tour

*   **`apps/backend`**: Fastify API, BullMQ orchestrator.
*   **`apps/ai-worker`**: Python FastAPI app for heavy lifting (PDFs, Embeddings).
*   **`apps/frontend`**: React dashboard.
*   **`packages/`**: Shared TS configs and libraries.
*   **`docs/`**: The source of truth for architecture and plans.

Thank you for building with us!
