import { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Auth middleware - currently disabled for demo mode.
 * 
 * Phase 5: Replace with Supabase JWT verification:
 * - Extract JWT from Authorization: Bearer {token}
 * - Verify with supabase.auth.getUser(token)
 * - Attach user.id as tenantId to request context
 */
export async function authMiddleware(
  _request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // Demo mode: allow all requests
  return;
}
