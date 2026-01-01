/**
 * Google OAuth Routes
 *
 * Phase 5F: Per-user OAuth with AES-256-GCM encrypted refresh tokens.
 * Handles OAuth initiation, callback, status check, and disconnect.
 */

import { FastifyInstance } from 'fastify';
import { google } from 'googleapis';
import { getPrismaClient } from '@/services/database.js';
import { getEncryptionService } from '@/services/encryption.service.js';
import { logger } from '@/logging/logger.js';

// OAuth2 scopes for Drive read access + email for display
const SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
];

// Frontend URL for redirects after OAuth
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Get OAuth2 client configuration
function getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/oauth/google/callback';

    if (!clientId || !clientSecret) {
        throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set for OAuth');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function oauthRoutes(fastify: FastifyInstance): Promise<void> {
    const prisma = getPrismaClient();

    /**
     * GET /api/oauth/google/start - Initiate OAuth flow
     *
     * Redirects user to Google consent screen.
     * After consent, Google redirects back to /api/oauth/google/callback.
     */
    fastify.get('/api/oauth/google/start', async (request, reply) => {
        try {
            const oauth2Client = getOAuth2Client();

            const authUrl = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: SCOPES,
                prompt: 'consent', // Force consent to get refresh token
            });

            logger.info('oauth_start_redirect');
            return reply.redirect(authUrl);
        } catch (error: any) {
            logger.error({ error: error.message }, 'oauth_start_failed');
            return reply.status(500).send({
                error: 'OAUTH_CONFIG_ERROR',
                message: error.message,
            });
        }
    });

    /**
     * GET /api/oauth/google/callback - Handle OAuth callback
     *
     * Exchanges authorization code for tokens.
     * Encrypts refresh token with AES-256-GCM.
     * Stores encrypted token in database.
     */
    fastify.get('/api/oauth/google/callback', async (request, reply) => {
        const { code, error: oauthError } = request.query as { code?: string; error?: string };

        if (oauthError) {
            logger.warn({ oauthError }, 'oauth_callback_denied');
            return reply.redirect(`${FRONTEND_URL}/drive?oauth=denied`);
        }

        if (!code) {
            return reply.redirect(`${FRONTEND_URL}/drive?oauth=error&reason=no_code`);
        }

        try {
            const oauth2Client = getOAuth2Client();
            const { tokens } = await oauth2Client.getToken(code);

            if (!tokens.refresh_token) {
                logger.warn('oauth_callback_no_refresh_token');
                return reply.redirect(`${FRONTEND_URL}/drive?oauth=error&reason=no_refresh_token`);
            }

            // Encrypt refresh token with AES-256-GCM
            const encryption = getEncryptionService();
            const encrypted = encryption.encrypt(tokens.refresh_token);

            // Get user email for display (optional - may fail if userinfo API not enabled)
            let userEmail = 'connected';
            try {
                oauth2Client.setCredentials(tokens);
                const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
                const userInfo = await oauth2.userinfo.get();
                userEmail = userInfo.data.email || 'connected';
            } catch (emailError: any) {
                logger.warn({ error: emailError.message }, 'oauth_userinfo_failed_using_default');
                // Continue with token storage even if email fetch fails
            }

            // Store OAuth credentials (using a system-level record for now)
            // In a multi-user system, this would be associated with a user ID
            await prisma.driveOAuth.upsert({
                where: { id: 'system' },
                update: {
                    encryptedRefreshToken: encrypted.ciphertext,
                    tokenIv: encrypted.iv,
                    tokenAuthTag: encrypted.authTag,
                    userEmail,
                    connectedAt: new Date(),
                },
                create: {
                    id: 'system',
                    encryptedRefreshToken: encrypted.ciphertext,
                    tokenIv: encrypted.iv,
                    tokenAuthTag: encrypted.authTag,
                    userEmail,
                    connectedAt: new Date(),
                },
            });

            logger.info({ userEmail }, 'oauth_callback_success');
            return reply.redirect(`${FRONTEND_URL}/drive?oauth=success`);
        } catch (error: any) {
            logger.error({ error: error.message }, 'oauth_callback_failed');
            return reply.redirect(`${FRONTEND_URL}/drive?oauth=error&reason=${encodeURIComponent(error.message)}`);
        }
    });

    /**
     * GET /api/oauth/google/status - Check OAuth connection status
     *
     * Returns whether a Google account is connected.
     */
    fastify.get('/api/oauth/google/status', async (request, reply) => {
        try {
            const oauth = await prisma.driveOAuth.findUnique({
                where: { id: 'system' },
            });

            if (!oauth || !oauth.encryptedRefreshToken) {
                return reply.send({
                    connected: false,
                    userEmail: null,
                    connectedAt: null,
                });
            }

            return reply.send({
                connected: true,
                userEmail: oauth.userEmail,
                connectedAt: oauth.connectedAt?.toISOString(),
            });
        } catch (error: any) {
            logger.error({ error: error.message }, 'oauth_status_failed');
            return reply.status(500).send({
                error: 'OAUTH_STATUS_ERROR',
                message: error.message,
            });
        }
    });

    /**
     * GET /api/oauth/google/access-token - Get access token for Google Picker
     *
     * Returns short-lived access token using stored refresh token.
     * Used by frontend to initialize Google Drive Picker.
     */
    fastify.get('/api/oauth/google/access-token', async (request, reply) => {
        try {
            const oauth = await prisma.driveOAuth.findUnique({
                where: { id: 'system' },
            });

            if (!oauth || !oauth.encryptedRefreshToken) {
                return reply.status(401).send({
                    error: 'NOT_CONNECTED',
                    message: 'Google account not connected. Please connect first.',
                });
            }

            // Decrypt refresh token
            const encryption = getEncryptionService();
            const refreshToken = encryption.decrypt({
                ciphertext: oauth.encryptedRefreshToken,
                iv: oauth.tokenIv,
                authTag: oauth.tokenAuthTag,
            });

            // Exchange refresh token for access token
            const oauth2Client = getOAuth2Client();
            oauth2Client.setCredentials({ refresh_token: refreshToken });

            const { credentials } = await oauth2Client.refreshAccessToken();

            if (!credentials.access_token) {
                throw new Error('Failed to get access token');
            }

            logger.info('oauth_access_token_success');
            return reply.send({
                accessToken: credentials.access_token,
                expiresIn: credentials.expiry_date
                    ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
                    : 3600,
            });
        } catch (error: any) {
            logger.error({ error: error.message }, 'oauth_access_token_failed');
            return reply.status(500).send({
                error: 'ACCESS_TOKEN_ERROR',
                message: error.message,
            });
        }
    });

    /**
     * POST /api/oauth/google/disconnect - Disconnect Google account
     *
     * Removes stored OAuth credentials.
     */
    fastify.post('/api/oauth/google/disconnect', async (request, reply) => {
        try {
            await prisma.driveOAuth.delete({
                where: { id: 'system' },
            }).catch(() => {
                // Ignore if not found
            });

            logger.info('oauth_disconnect_success');
            return reply.send({ success: true });
        } catch (error: any) {
            logger.error({ error: error.message }, 'oauth_disconnect_failed');
            return reply.status(500).send({
                error: 'OAUTH_DISCONNECT_ERROR',
                message: error.message,
            });
        }
    });
}
