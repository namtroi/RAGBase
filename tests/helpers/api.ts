import { FastifyInstance } from 'fastify';

let app: FastifyInstance | null = null;

/**
 * Create Fastify test client
 * Lazy-initialized, shared across tests in same file
 */
export async function getTestApp(): Promise<FastifyInstance> {
  if (!app) {
    // Import app factory (to be created in Phase 04)
    const { createApp } = await import('@/app');
    app = await createApp();
  }
  return app;
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
