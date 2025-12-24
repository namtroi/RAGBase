import { createApp } from '@/app.js';
import { eventBus } from '@/services/event-bus.js';
import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('GET /api/events (SSE)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await createApp();
    });

    afterAll(async () => {
        await app.close();
    });

    describe('authentication', () => {
        it('should require authentication', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/events',
                // No auth header
            });

            expect(response.statusCode).toBe(401);
        });
    });

    describe('EventBus integration', () => {
        it('should export singleton instance', () => {
            expect(eventBus).toBeDefined();
            expect(typeof eventBus.emit).toBe('function');
            expect(typeof eventBus.subscribe).toBe('function');
        });

        it('should emit and receive events', () => {
            const events: unknown[] = [];
            const unsubscribe = eventBus.subscribe((event) => {
                events.push(event);
            });

            eventBus.emit('document:status', { id: 'test-123', status: 'COMPLETED' });

            expect(events.length).toBe(1);
            expect(events[0]).toMatchObject({
                type: 'document:status',
                payload: { id: 'test-123', status: 'COMPLETED' },
            });

            unsubscribe();
        });
    });

    // Note: Full SSE streaming tests require real HTTP connection
    // app.inject() waits for response to complete, which never happens with SSE
    // The above unit tests verify the core functionality
    // E2E testing with actual browser/curl is recommended for full SSE validation
});
