/**
 * EventProvider
 * 
 * App-level provider that manages SSE connection and 
 * invalidates React Query caches on server events.
 */

import { getApiKey } from '@/api/client';
import { useQueryClient } from '@tanstack/react-query';
import { ReactNode, useEffect, useMemo } from 'react';
import { EventContext } from '../contexts/EventContext';
import { ServerEvent, useSSE } from '../hooks/use-sse';

interface EventProviderProps {
    children: ReactNode;
}

export function EventProvider({ children }: EventProviderProps) {
    const queryClient = useQueryClient();

    // Build SSE URL with API key (EventSource doesn't support headers)
    const sseUrl = useMemo(() => {
        const apiKey = getApiKey();
        if (!apiKey) return null; // Don't connect without API key
        return `/api/events?apiKey=${encodeURIComponent(apiKey)}`;
    }, []);

    const handleEvent = (event: ServerEvent) => {
        console.log('📡 SSE Event:', event.type, event.payload);

        switch (event.type) {
            case 'document:created':
            case 'document:status':
            case 'document:availability':
            case 'document:deleted':
            case 'bulk:completed':
                // Invalidate documents list and individual document
                queryClient.invalidateQueries({ queryKey: ['documents'] });
                if (event.payload.id) {
                    queryClient.invalidateQueries({ queryKey: ['document', event.payload.id] });
                }
                break;

            case 'sync:start':
            case 'sync:complete':
            case 'sync:error':
                // Invalidate drive configs
                queryClient.invalidateQueries({ queryKey: ['driveConfigs'] });
                // Also invalidate documents as sync may have added/updated them
                queryClient.invalidateQueries({ queryKey: ['documents'] });
                break;

            case 'driveConfig:deleted':
                // Invalidate drive configs and documents (connectionState changed)
                queryClient.invalidateQueries({ queryKey: ['driveConfigs'] });
                queryClient.invalidateQueries({ queryKey: ['documents'] });
                break;
        }
    };

    const { isConnected, lastEvent } = useSSE(sseUrl, {
        onEvent: handleEvent,
        onError: (e) => console.warn('SSE connection error:', e),
    });

    useEffect(() => {
        if (isConnected) {
            console.log('✅ SSE connected');
        } else {
            console.log('⚠️ SSE disconnected');
        }
    }, [isConnected]);

    const value = useMemo(() => ({
        isConnected,
        lastEvent,
    }), [isConnected, lastEvent]);

    return (
        <EventContext.Provider value={value}>
            {children}
        </EventContext.Provider>
    );
}
