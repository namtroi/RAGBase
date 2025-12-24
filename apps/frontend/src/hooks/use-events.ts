/**
 * useEvents Hook
 * 
 * Access SSE event context from EventProvider.
 */

import { useContext } from 'react';
import { EventContext } from '../contexts/EventContext';

export function useEvents() {
    return useContext(EventContext);
}
