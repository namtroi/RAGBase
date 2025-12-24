/**
 * SSE Route
 * 
 * Server-Sent Events endpoint for real-time updates.
 * Clients receive document status and sync events.
 */

import { eventBus, ServerEvent } from '@/services/event-bus.js';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

// Track active connections for cleanup
const activeConnections = new Set<FastifyReply>();

export async function sseRoute(fastify: FastifyInstance): Promise<void> {
    fastify.get('/api/events', async (request: FastifyRequest, reply: FastifyReply) => {
        // Set SSE headers
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx buffering
        });

        activeConnections.add(reply);

        // Send initial connection message
        reply.raw.write(': connected\n\n');

        // Subscribe to EventBus
        const unsubscribe = eventBus.subscribe((event: ServerEvent) => {
            const data = JSON.stringify(event);
            reply.raw.write(`data: ${data}\n\n`);
        });

        // Heartbeat to keep connection alive (every 30s)
        const heartbeatInterval = setInterval(() => {
            reply.raw.write(': heartbeat\n\n');
        }, 30000);

        // Cleanup on disconnect
        request.raw.on('close', () => {
            clearInterval(heartbeatInterval);
            unsubscribe();
            activeConnections.delete(reply);
        });

        // Don't return - keep connection open
        // Fastify will handle the stream
    });
}

// Utility to close all connections (for graceful shutdown)
export function closeAllSSEConnections(): void {
    for (const reply of activeConnections) {
        reply.raw.end();
    }
    activeConnections.clear();
}
