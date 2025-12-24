import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus, eventBus, ServerEvent } from '@/services/event-bus.js';

describe('EventBus', () => {
    let bus: EventBus;

    beforeEach(() => {
        bus = new EventBus();
    });

    afterEach(() => {
        bus.removeAllListeners();
    });

    describe('emit', () => {
        it('should emit event with correct structure', () => {
            const listener = vi.fn();
            bus.subscribe(listener);

            bus.emit('document:status', { id: 'doc-123', status: 'COMPLETED' });

            expect(listener).toHaveBeenCalledTimes(1);
            const event: ServerEvent = listener.mock.calls[0][0];
            expect(event.type).toBe('document:status');
            expect(event.payload).toEqual({ id: 'doc-123', status: 'COMPLETED' });
            expect(event.timestamp).toBeDefined();
        });

        it('should include ISO timestamp', () => {
            const listener = vi.fn();
            bus.subscribe(listener);

            const before = new Date().toISOString();
            bus.emit('document:created', { id: 'doc-456' });
            const after = new Date().toISOString();

            const event: ServerEvent = listener.mock.calls[0][0];
            expect(event.timestamp >= before).toBe(true);
            expect(event.timestamp <= after).toBe(true);
        });
    });

    describe('subscribe', () => {
        it('should allow multiple subscribers', () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();

            bus.subscribe(listener1);
            bus.subscribe(listener2);
            bus.emit('sync:start', { configId: 'cfg-123' });

            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(1);
        });

        it('should return unsubscribe function', () => {
            const listener = vi.fn();
            const unsubscribe = bus.subscribe(listener);

            bus.emit('sync:complete', { configId: 'cfg-123' });
            expect(listener).toHaveBeenCalledTimes(1);

            unsubscribe();
            bus.emit('sync:complete', { configId: 'cfg-456' });
            expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
        });
    });

    describe('singleton', () => {
        it('should export singleton instance', () => {
            expect(eventBus).toBeInstanceOf(EventBus);
        });
    });

    describe('event types', () => {
        const eventTypes = [
            'document:created',
            'document:status',
            'sync:start',
            'sync:complete',
            'sync:error',
            'sync:progress',
        ] as const;

        it.each(eventTypes)('should emit %s event', (eventType) => {
            const listener = vi.fn();
            bus.subscribe(listener);

            bus.emit(eventType, { test: true });

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({ type: eventType })
            );
        });
    });
});
