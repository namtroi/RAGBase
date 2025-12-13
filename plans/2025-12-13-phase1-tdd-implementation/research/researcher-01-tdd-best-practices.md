# TDD Best Practices: TypeScript/Node.js 2025

## 1. RED-GREEN-REFACTOR Workflow (Backend APIs)

### Pattern
1. **RED**: Write failing test for new feature (AAA Model)
   - Arrange: Setup test data & mocks
   - Act: Execute function under test
   - Assert: Verify expectations
2. **GREEN**: Write minimal code to pass test
3. **REFACTOR**: Improve code without changing behavior

### Sweet Spot
Write tests early enough for safety net, but post-design clarity—avoid excessive refactoring from premature tests. Use watch mode (`vitest --watch`) for instant feedback loops.

---

## 2. Vitest vs Jest (2025)

| Aspect | Vitest | Jest |
|--------|--------|------|
| **Speed** | 30-70% faster (native ESM) | Slower (CommonJS overhead) |
| **TypeScript** | Native, zero-config | Requires ts-jest setup |
| **API Compat** | 99% Jest-compatible | Industry standard (legacy) |
| **Vite Ecosystem** | Seamless integration | External tool |

**Recommendation**: Use **Vitest** for modern TypeScript/Node.js stacks. Jest only if locked into CommonJS ecosystem.

---

## 3. Testcontainers (PostgreSQL + Redis)

### Setup Pattern
```typescript
import { PostgreSQLContainer, RedisContainer } from 'testcontainers';

describe('ETL Pipeline Integration', () => {
  let postgres: PostgreSQLContainer;
  let redis: RedisContainer;

  beforeAll(async () => {
    postgres = await new PostgreSQLContainer().start();
    redis = await new RedisContainer().start();
    // Connect with dynamic ports
    const connStr = postgres.getConnectionUri();
  });

  afterAll(async () => {
    await postgres.stop();
    await redis.stop();
  });
});
```

### Best Practices
- Use dynamic port mapping (avoids CI collisions)
- Parallel test execution with isolated containers
- Real service state → catches integration bugs missed by mocks
- Slower than unit tests; use for critical paths only

---

## 4. Mock Strategies (External Services)

### Network-Level Mocking: Mock Service Worker (MSW)
```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.post('https://embedding-api.com/embed', () => {
    return HttpResponse.json({ embedding: [0.1, 0.2, ...] });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
```

### Service-Level Mocking (Preferred for ETL)
```typescript
// Mock at service boundary, not library level
vi.mock('./services/pythonWorker', () => ({
  executePythonTransform: vi.fn()
    .mockResolvedValue({ result: 'transformed-data' })
}));
```

### HTTP-Level: Nock (Legacy)
```typescript
nock('https://api.example.com')
  .post('/transform', { data: 'input' })
  .reply(200, { result: 'output' });
```

**Pattern**: Avoid mocking Axios/fetch directly—mock at service level for stability.

---

## 5. Test Fixtures & Deterministic Data

### Fixture Organization
```typescript
// fixtures/test-data.ts
export const createTestEmbedding = (seed: number) => {
  const rng = seededRandom(seed); // Deterministic
  return Array(384).fill(0).map(() => rng());
};

export const createTestRecord = (overrides = {}) => ({
  id: 'test-1',
  content: 'deterministic content',
  timestamp: new Date('2025-12-13T00:00:00Z'), // Fixed
  ...overrides
});
```

### Parameterized Tests
```typescript
describe.each([
  { input: smallDataset, expectedTime: '<100ms' },
  { input: largeDataset, expectedTime: '<5s' }
])('ETL performance', ({ input, expectedTime }) => {
  it(`processes within ${expectedTime}`, () => {
    // Test with deterministic data
  });
});
```

### Faker for Realism (Seeded)
```typescript
import { faker } from '@faker-js/faker';

faker.seed(42); // Deterministic
const testRecords = Array(100).fill(0).map(() => ({
  email: faker.internet.email(),
  name: faker.person.fullName()
}));
```

---

## 6. TypeScript Type Safety in Tests

### Type-Safe Mocking
```typescript
// ✅ Type-safe
vi.mock('./service', () => ({
  fetchData: vi.fn<[string], Promise<Data>>()
}));

// ❌ Not type-safe (Jest/Vitest default)
jest.mock('./service');
```

Use libraries supporting typed mocks; configure strict mode in tsconfig.

---

## Key Takeaways for ETL/Data Pipelines

1. **Test Coverage Pyramid**: Unit (70%) → Integration (20%) → E2E (10%)
2. **Determinism First**: Fixed timestamps, seeded randomness, no network calls in unit tests
3. **Testcontainers for DB Logic**: Real PostgreSQL/Redis beats mocks for data transformation bugs
4. **Mock External APIs at Service Layer**: Decouple from implementation details
5. **CI-Friendly**: Dynamic port mapping, parallel execution, no host dependencies

---

## Unresolved Questions

- Optimal balance between Testcontainers cost (startup time) vs Vitest mock speed for large test suites?
- How to handle time-dependent transformations (timestamps, TTL) in deterministic fixtures?
- Best practices for snapshot testing in ETL when data structures evolve?

---

## Sources

- [nodejs-testing-best-practices (Apr 2025)](https://github.com/goldbergyoni/nodejs-testing-best-practices)
- [Jest vs Vitest 2025 Comparison](https://medium.com/@ruverd/jest-vs-vitest-which-test-runner-should-you-use-in-2025-5c85e4f2bda9)
- [Getting Started with Testcontainers for Node.js](https://testcontainers.com/guides/getting-started-with-testcontainers-for-nodejs/)
- [Testcontainers Best Practices](https://www.docker.com/blog/testcontainers-best-practices/)
- [Mock Service Worker Documentation](https://mswjs.io/)
- [Nock - HTTP Mocking for Node.js](https://blog.logrocket.com/how-to-test-code-that-depends-on-external-apis-in-node-js/)
- [TypeScript ETL Testing](https://blog.logrocket.com/use-typescript-instead-python-etl-pipelines/)
- [ETL Testing: Comprehensive Guide](https://www.astera.com/type/blog/etl-testing/)
