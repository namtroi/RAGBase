/**
 * Integration Test Helper - Fastify App
 * 
 * ⚠️ NOTE: IDE shows TypeScript errors for 'fastify' import - this is EXPECTED and SAFE
 * 
 * Why the error occurs:
 * - This file is in tests/ directory (root workspace)
 * - 'fastify' is installed in apps/backend/node_modules (backend workspace)
 * - TypeScript in tests/ can't see apps/backend/node_modules
 * 
 * Why it's safe:
 * - This file is excluded from TypeScript compilation (see tests/tsconfig.json)
 * - File is not imported by any tests yet (prepared for Phase 04)
 * - Will work correctly at runtime when Vitest runs from apps/backend/
 * 
 * When to fix:
 * - Phase 04: Integration Tests implementation
 * - At that point, this file will be imported and work correctly
 * 
 * @see docs/TYPESCRIPT_PATH_FIX.md for full explanation
 */
import { FastifyInstance } from 'fastify';

let app: FastifyInstance | null = null;

/**
 * Create Fastify test client
 * Lazy-initialized, shared across tests in same file
 */
export async function getTestApp(): Promise<FastifyInstance> {
  if (!app) {
    // Import app factory (to be created in Phase 04)
    const { createApp } = await import('@/app.js');
    app = await createApp();
  }
  return app!;
}

/**
 * Alias for getTestApp - used by integration tests
 */
export async function createTestApp(): Promise<FastifyInstance> {
  return getTestApp();
}

export async function closeTestApp(): Promise<void> {
  if (app) {
    await app.close();
    app = null;
  }
}

/**
 * Make authenticated request
 */
export function authHeaders(apiKey: string = 'test-api-key'): Record<string, string> {
  return {
    'X-API-Key': apiKey,
  };
}

/**
 * Inject helper for cleaner test syntax
 */
export async function inject(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  options?: {
    payload?: any;
    headers?: Record<string, string>;
    auth?: boolean;
  }
): Promise<any> {
  const app = await getTestApp();
  const headers = {
    ...(options?.auth !== false ? authHeaders() : {}),
    ...options?.headers,
  };

  const response = await app.inject({
    method,
    url,
    payload: options?.payload,
    headers,
  });

  return {
    status: response.statusCode,
    body: response.json(),
    headers: response.headers,
  };
}
