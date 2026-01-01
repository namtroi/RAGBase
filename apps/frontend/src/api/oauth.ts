/**
 * OAuth API Endpoints
 * Phase 5F: Per-user OAuth integration
 */

import { api } from './client';

export interface OAuthStatus {
    connected: boolean;
    userEmail: string | null;
    connectedAt: string | null;
}

export const oauthApi = {
    /**
     * Get OAuth connection status
     */
    getStatus: () => api.get<OAuthStatus>('/oauth/google/status'),

    /**
     * Disconnect Google account
     */
    disconnect: () => api.post<{ success: boolean }>('/oauth/google/disconnect', {}),

    /**
     * Get OAuth start URL (for redirect)
     */
    getStartUrl: () => '/api/oauth/google/start',

    /**
     * Get access token for Google Picker
     */
    getAccessToken: () => api.get<{ accessToken: string; expiresIn: number }>('/oauth/google/access-token'),
};
