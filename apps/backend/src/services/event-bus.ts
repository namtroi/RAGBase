/**
 * Event Bus Service
 * 
 * In-memory pub/sub for SSE real-time events.
 * Uses Node.js EventEmitter for decoupled event broadcasting.
 */

import { EventEmitter } from 'events';

export type EventType =
    | 'document:created'
    | 'document:status'
    | 'sync:start'
    | 'sync:complete'
    | 'sync:error'
    | 'sync:progress';

export interface ServerEvent {
    type: EventType;
    payload: Record<string, unknown>;
    timestamp: string;
}

export type EventListener = (event: ServerEvent) => void;

const INTERNAL_EVENT = 'server-event';

export class EventBus extends EventEmitter {
    /**
     * Emit an event to all subscribers
     */
    emit(type: EventType, payload: Record<string, unknown>): boolean {
        const event: ServerEvent = {
            type,
            payload,
            timestamp: new Date().toISOString(),
        };
        return super.emit(INTERNAL_EVENT, event);
    }

    /**
     * Subscribe to all events
     * @returns Unsubscribe function
     */
    subscribe(listener: EventListener): () => void {
        this.on(INTERNAL_EVENT, listener);
        return () => this.off(INTERNAL_EVENT, listener);
    }

    /**
     * Remove all event listeners
     */
    removeAllListeners(): this {
        return super.removeAllListeners(INTERNAL_EVENT);
    }
}

// Singleton instance
export const eventBus = new EventBus();
