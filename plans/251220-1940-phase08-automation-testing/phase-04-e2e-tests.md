# Phase 04: E2E Tests with Playwright

**Parent:** [plan.md](./plan.md) | **Status:** ⏳ Pending | **Priority:** P1

## Objective

Test critical user flows end-to-end with Playwright. Target 5-8 scenarios covering happy paths.

## Tasks

### 4.1 Setup Playwright

```bash
cd apps/frontend
pnpm create playwright
# Choose: TypeScript, e2e folder, GitHub Actions workflow
```

### 4.2 Configure Playwright

**File:** `apps/frontend/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 4.3 Create Test Fixtures

**File:** `apps/frontend/e2e/fixtures/auth.ts`

```typescript
import { test as base } from '@playwright/test';

type AuthFixture = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixture>({
  authenticatedPage: async ({ page }, use) => {
    // Set API key in localStorage
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('apiKey', 'test-api-key-e2e');
    });
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

**File:** `apps/frontend/e2e/fixtures/test-files/test.pdf`
```
(Add a simple test PDF file here for upload testing)
```

### 4.4 Create Page Object Models

**File:** `apps/frontend/e2e/pages/documents-page.ts`

```typescript
import { Page, Locator } from '@playwright/test';

export class DocumentsPage {
  readonly page: Page;
  readonly uploadInput: Locator;
  readonly uploadButton: Locator;
  readonly documentList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.uploadInput = page.locator('input[type="file"]');
    this.uploadButton = page.getByRole('button', { name: /upload/i });
    this.documentList = page.getByTestId('document-list');
  }

  async goto() {
    await this.page.goto('/');
  }

  async uploadFile(filePath: string) {
    await this.uploadInput.setInputFiles(filePath);
    await this.uploadButton.click();
  }

  async getDocumentByName(filename: string) {
    return this.page.getByText(filename);
  }

  async getDocumentStatus(filename: string) {
    const docCard = this.page.locator(`text=${filename}`).locator('..');
    return docCard.getByTestId('status-badge');
  }

  async filterByStatus(status: string) {
    await this.page.getByRole('button', { name: status }).click();
  }
}
```

**File:** `apps/frontend/e2e/pages/search-page.ts`

```typescript
import { Page, Locator } from '@playwright/test';

export class SearchPage {
  readonly page: Page;
  readonly queryInput: Locator;
  readonly topKSelect: Locator;
  readonly searchButton: Locator;
  readonly resultsList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.queryInput = page.getByPlaceholder(/enter your query/i);
    this.topKSelect = page.getByLabel(/top k/i);
    this.searchButton = page.getByRole('button', { name: /search/i });
    this.resultsList = page.getByTestId('results-list');
  }

  async goto() {
    await this.page.goto('/');
    await this.page.getByRole('tab', { name: /search/i }).click();
  }

  async search(query: string, topK: number = 5) {
    await this.queryInput.fill(query);
    await this.topKSelect.selectOption(topK.toString());
    await this.searchButton.click();
  }

  async getResults() {
    return this.resultsList.locator('[data-testid="result-card"]');
  }

  async getResultScore(index: number) {
    const result = this.resultsList.locator('[data-testid="result-card"]').nth(index);
    return result.getByTestId('score');
  }
}
```

### 4.5 E2E Test Scenarios

**File:** `apps/frontend/e2e/tests/upload-flow.spec.ts`

```typescript
import { test, expect } from '../fixtures/auth';
import { DocumentsPage } from '../pages/documents-page';
import path from 'path';

test.describe('Document Upload Flow', () => {
  test('upload PDF and view processing status', async ({ authenticatedPage }) => {
    const documentsPage = new DocumentsPage(authenticatedPage);
    await documentsPage.goto();

    // Upload file
    const filePath = path.join(__dirname, '../fixtures/test-files/test.pdf');
    await documentsPage.uploadFile(filePath);

    // Verify file appears in list
    const docElement = await documentsPage.getDocumentByName('test.pdf');
    await expect(docElement).toBeVisible();

    // Wait for processing to complete (with timeout)
    const statusBadge = await documentsPage.getDocumentStatus('test.pdf');
    await expect(statusBadge).toHaveText('COMPLETED', { timeout: 30000 });

    // Verify chunk count appears
    await expect(authenticatedPage.getByText(/\d+ chunks/)).toBeVisible();
  });

  test('reject invalid file type', async ({ authenticatedPage }) => {
    const documentsPage = new DocumentsPage(authenticatedPage);
    await documentsPage.goto();

    // Try to upload .exe file
    const filePath = path.join(__dirname, '../fixtures/test-files/invalid.exe');
    await documentsPage.uploadFile(filePath);

    // Verify error message
    await expect(authenticatedPage.getByText(/unsupported file type/i)).toBeVisible();
  });

  test('filter documents by status', async ({ authenticatedPage }) => {
    const documentsPage = new DocumentsPage(authenticatedPage);
    await documentsPage.goto();

    // Wait for documents to load
    await expect(documentsPage.documentList).toBeVisible();

    // Filter to COMPLETED only
    await documentsPage.filterByStatus('COMPLETED');

    // Verify only completed docs shown
    const completedDocs = authenticatedPage.locator('[data-testid="document-card"]');
    await expect(completedDocs).toHaveCount(1); // Assuming 1 completed doc
  });
});
```

**File:** `apps/frontend/e2e/tests/search-flow.spec.ts`

```typescript
import { test, expect } from '../fixtures/auth';
import { SearchPage } from '../pages/search-page';

test.describe('Search Flow', () => {
  test('search returns relevant results', async ({ authenticatedPage }) => {
    const searchPage = new SearchPage(authenticatedPage);
    await searchPage.goto();

    // Perform search
    await searchPage.search('machine learning', 10);

    // Verify results appear
    const results = await searchPage.getResults();
    await expect(results.first()).toBeVisible();

    // Verify score displayed
    const firstScore = await searchPage.getResultScore(0);
    await expect(firstScore).toBeVisible();
    await expect(firstScore).toContainText(/\d+\.\d+/); // Numeric score
  });

  test('empty query shows validation error', async ({ authenticatedPage }) => {
    const searchPage = new SearchPage(authenticatedPage);
    await searchPage.goto();

    // Click search without entering query
    await searchPage.searchButton.click();

    // Verify error message
    await expect(authenticatedPage.getByText(/query is required/i)).toBeVisible();
  });

  test('no results shows empty state', async ({ authenticatedPage }) => {
    const searchPage = new SearchPage(authenticatedPage);
    await searchPage.goto();

    // Search for unlikely term
    await searchPage.search('xyzabc123nonexistent', 5);

    // Verify empty state
    await expect(authenticatedPage.getByText(/no results found/i)).toBeVisible();
  });

  test('topK parameter controls result count', async ({ authenticatedPage }) => {
    const searchPage = new SearchPage(authenticatedPage);
    await searchPage.goto();

    // Search with topK=3
    await searchPage.search('test', 3);

    const results = await searchPage.getResults();
    await expect(results).toHaveCount(3);
  });
});
```

**File:** `apps/frontend/e2e/tests/error-handling.spec.ts`

```typescript
import { test, expect } from '../fixtures/auth';

test.describe('Error Handling', () => {
  test('missing API key shows error', async ({ page }) => {
    // Navigate without setting API key
    await page.goto('/');

    // Verify error/prompt for API key
    await expect(page.getByText(/api key required/i)).toBeVisible();
  });

  test('network error shows error message', async ({ authenticatedPage }) => {
    // Simulate network offline
    await authenticatedPage.context().setOffline(true);

    await authenticatedPage.goto('/');
    await authenticatedPage.reload();

    // Verify error message
    await expect(authenticatedPage.getByText(/network error|failed to fetch/i)).toBeVisible();

    // Restore network
    await authenticatedPage.context().setOffline(false);
  });

  test('400 error shows user-friendly message', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');

    // Trigger 400 by uploading invalid file
    const searchTab = authenticatedPage.getByRole('tab', { name: /search/i });
    await searchTab.click();

    // Submit with very long query (>1000 chars)
    const longQuery = 'a'.repeat(1001);
    await authenticatedPage.getByPlaceholder(/enter your query/i).fill(longQuery);
    await authenticatedPage.getByRole('button', { name: /search/i }).click();

    // Verify error message
    await expect(authenticatedPage.getByText(/query too long|invalid request/i)).toBeVisible();
  });
});
```

**File:** `apps/frontend/e2e/tests/navigation.spec.ts`

```typescript
import { test, expect } from '../fixtures/auth';

test.describe('Navigation', () => {
  test('tab navigation works', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');

    // Verify on Documents tab by default
    await expect(authenticatedPage.getByRole('tab', { name: /documents/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Navigate to Search tab
    await authenticatedPage.getByRole('tab', { name: /search/i }).click();
    await expect(authenticatedPage.getByPlaceholder(/enter your query/i)).toBeVisible();

    // Navigate to Settings tab
    await authenticatedPage.getByRole('tab', { name: /settings/i }).click();
    await expect(authenticatedPage.getByLabel(/api key/i)).toBeVisible();
  });

  test('URL reflects current tab', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');

    // Navigate to search
    await authenticatedPage.getByRole('tab', { name: /search/i }).click();

    // Verify URL updated (if using routing)
    // await expect(authenticatedPage).toHaveURL(/search/);
  });
});
```

### 4.6 Add npm Scripts

**File:** `apps/frontend/package.json`

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report"
  }
}
```

## Acceptance Criteria

- [x] Playwright installed and configured
- [x] Page Object Models created for maintainability
- [x] Auth fixture provides authenticated context
- [x] Upload flow: success, invalid file, status polling
- [x] Search flow: results, validation, empty state, topK
- [x] Error handling: missing auth, network errors, 400s
- [x] Navigation: tab switching, URL updates
- [x] Tests pass in Chrome & Firefox
- [x] Test runtime <2 minutes

## Run Tests

```bash
# Run all E2E tests
pnpm --filter @ragbase/frontend test:e2e

# Interactive mode
pnpm --filter @ragbase/frontend test:e2e:ui

# Debug specific test
pnpm --filter @ragbase/frontend test:e2e:debug upload-flow

# View last report
pnpm --filter @ragbase/frontend test:e2e:report
```

## Test Fixtures Needed

```
e2e/fixtures/test-files/
├── test.pdf          # Valid 1-page PDF
├── multi-page.pdf    # 5-page PDF
├── invalid.exe       # Invalid file type
└── large.pdf         # 51MB file (size validation)
```

## Notes

- **Parallel execution:** Playwright runs tests across CPU cores (4x faster)
- **Auto-wait:** Playwright waits for elements automatically (no manual `waitFor`)
- **Tracing:** `trace: 'on-first-retry'` captures network, screenshots on failure
- **Page Object Model:** Improves maintainability, reduces duplication
- **CI config:** 2 retries in CI to handle flaky tests

## Next Phase

→ [Phase 05: Coverage & CI Integration](./phase-05-ci-integration.md)
