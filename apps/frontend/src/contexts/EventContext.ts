/**
 * Event Context
 * 
 * Shared context for SSE events.
 */

import { createContext } from 'react';
import { ServerEvent } from '../hooks/use-sse';

export interface EventContextValue {
    isConnected: boolean;
    lastEvent: ServerEvent | null;
}

export const EventContext = createContext<EventContextValue>({
    isConnected: false,
    lastEvent: null,
});
