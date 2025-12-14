import { timingSafeEqual } from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';

// Routes that don't require authentication
const PUBLIC_ROUTES = new Set(['/health', '/internal/callback']);

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip auth for public routes (exact match without query string)
  const path = request.url.split('?')[0];
  if (PUBLIC_ROUTES.has(path)) {
    return;
  }

  const apiKey = request.headers['x-api-key'];
  const expectedKey = process.env.API_KEY;

  // Constant-time comparison to prevent timing attacks
  let isValid = false;
  if (typeof apiKey === 'string' && typeof expectedKey === 'string') {
    const apiKeyBuffer = Buffer.from(apiKey, 'utf8');
    const expectedKeyBuffer = Buffer.from(expectedKey, 'utf8');

    // Check length first (constant-time)
    if (apiKeyBuffer.length === expectedKeyBuffer.length) {
      try {
        timingSafeEqual(apiKeyBuffer, expectedKeyBuffer);
        isValid = true;
      } catch {
        isValid = false;
      }
    }
  }

  if (!isValid) {
    reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid or missing API key',
    });
    return;
  }
}
