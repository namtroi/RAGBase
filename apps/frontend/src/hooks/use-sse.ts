/**
 * useSSE Hook
 * 
 * React hook for Server-Sent Events with auto-reconnect.
 * Used for real-time updates from backend.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ServerEvent {
    type: string;
    payload: Record<string, unknown>;
    timestamp: string;
}

interface UseSSEOptions {
    onEvent?: (event: ServerEvent) => void;
    onError?: (error: Event) => void;
    reconnectDelay?: number;
    maxRetries?: number;
}

interface UseSSEResult {
    isConnected: boolean;
    lastEvent: ServerEvent | null;
    error: Event | null;
    reconnect: () => void;
}

export function useSSE(url: string | null, options: UseSSEOptions = {}): UseSSEResult {
    const {
        onEvent,
        onError,
        reconnectDelay = 3000,
        maxRetries = 5,
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState<ServerEvent | null>(null);
    const [error, setError] = useState<Event | null>(null);

    const eventSourceRef = useRef<EventSource | null>(null);
    const retriesRef = useRef(0);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Use refs for stable handler references
    const onEventRef = useRef(onEvent);
    const onErrorRef = useRef(onError);

    // Update refs on every render
    useEffect(() => {
        onEventRef.current = onEvent;
        onErrorRef.current = onError;
    }, [onEvent, onError]);

    const connect = useCallback(() => {
        // Skip if no URL (no API key)
        if (!url) return;

        // Cleanup existing connection
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        const eventSource = new EventSource(url, { withCredentials: true });
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            setIsConnected(true);
            setError(null);
            retriesRef.current = 0;
        };

        eventSource.onmessage = (e) => {
            try {
                const event: ServerEvent = JSON.parse(e.data);
                setLastEvent(event);
                onEventRef.current?.(event);
            } catch {
                // Ignore heartbeat comments (start with :)
            }
        };

        eventSource.onerror = (e) => {
            setIsConnected(false);
            setError(e);
            onErrorRef.current?.(e);
            eventSource.close();

            // Auto-reconnect with exponential backoff
            if (retriesRef.current < maxRetries) {
                const delay = reconnectDelay * Math.pow(2, retriesRef.current);
                retriesRef.current++;

                reconnectTimeoutRef.current = setTimeout(() => {
                    connect();
                }, delay);
            }
        };
    }, [url, reconnectDelay, maxRetries]);

    const reconnect = useCallback(() => {
        retriesRef.current = 0;
        connect();
    }, [connect]);

    useEffect(() => {
        if (url) {
            connect();
        }

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [connect, url]);

    return { isConnected, lastEvent, error, reconnect };
}
