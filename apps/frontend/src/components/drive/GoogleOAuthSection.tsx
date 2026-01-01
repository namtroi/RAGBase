/**
 * Google OAuth Button Component
 * Phase 5F: Per-user OAuth integration
 */

import { oauthApi } from '@/api/oauth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Loader2, LogOut, UserCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

export function GoogleOAuthSection() {
    const queryClient = useQueryClient();
    const [showSuccess, setShowSuccess] = useState(false);

    // Check for OAuth callback result in URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const oauthResult = params.get('oauth');

        if (oauthResult === 'success') {
            setShowSuccess(true);
            // Clear URL params
            window.history.replaceState({}, '', window.location.pathname);
            // Refetch status
            queryClient.invalidateQueries({ queryKey: ['oauth-status'] });
            // Hide success after 3s
            setTimeout(() => setShowSuccess(false), 3000);
        } else if (oauthResult === 'error' || oauthResult === 'denied') {
            const reason = params.get('reason');
            console.error('OAuth failed:', reason || oauthResult);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [queryClient]);

    // Fetch OAuth status
    const { data: status, isLoading } = useQuery({
        queryKey: ['oauth-status'],
        queryFn: oauthApi.getStatus,
    });

    // Disconnect mutation
    const disconnectMutation = useMutation({
        mutationFn: oauthApi.disconnect,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['oauth-status'] });
        },
    });

    const handleConnect = () => {
        // Redirect to OAuth flow
        window.location.href = oauthApi.getStartUrl();
    };

    const handleDisconnect = async () => {
        if (confirm('Are you sure you want to disconnect your Google account?')) {
            await disconnectMutation.mutateAsync();
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Checking OAuth status...</span>
                </div>
            </div>
        );
    }

    const isConnected = status?.connected;

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span className="font-medium text-gray-900">Google Account</span>
                </div>

                {isConnected && (
                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Connected
                    </span>
                )}
            </div>

            {/* Status / Actions */}
            {isConnected ? (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <UserCircle className="w-4 h-4 text-gray-400" />
                        <span>{status?.userEmail || 'Unknown account'}</span>
                    </div>

                    <button
                        onClick={handleDisconnect}
                        disabled={disconnectMutation.isPending}
                        className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 transition-colors"
                    >
                        {disconnectMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <LogOut className="w-4 h-4" />
                        )}
                        Disconnect
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-sm text-gray-500">
                        Connect your Google account to sync files from your Drive folders.
                    </p>

                    <button
                        onClick={handleConnect}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Connect Google Account
                    </button>
                </div>
            )}

            {/* Success Message */}
            {showSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
                    <CheckCircle className="w-4 h-4" />
                    Successfully connected!
                </div>
            )}
        </div>
    );
}
