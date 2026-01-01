/**
 * Settings Page
 * Phase 5I: System dashboard showing health status
 */

import { api } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import {
    Server,
    Database,
    Lock,
    Cpu,
    CheckCircle,
    XCircle,
    AlertTriangle,
    RefreshCw,
    Settings
} from 'lucide-react';

interface SystemStatus {
    vectorDb: {
        provider: 'qdrant' | 'pgvector';
        status: 'healthy' | 'error' | 'not_configured';
        qdrantConfigured: boolean;
        qdrantConnected: boolean;
    };
    encryption: {
        configured: boolean;
        algorithm: string;
    };
    aiWorker: {
        url: string;
        status: 'healthy' | 'error' | 'unknown';
        hybridEmbeddings: boolean;
    };
    oauth: {
        configured: boolean;
    };
    uptime: number;
    version: string;
}

function StatusBadge({ status }: { status: 'healthy' | 'error' | 'unknown' | 'not_configured' | boolean }) {
    if (status === true || status === 'healthy') {
        return (
            <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="w-4 h-4" />
                Healthy
            </span>
        );
    }
    if (status === 'not_configured') {
        return (
            <span className="flex items-center gap-1 text-yellow-600">
                <AlertTriangle className="w-4 h-4" />
                Not Configured
            </span>
        );
    }
    if (status === 'unknown') {
        return (
            <span className="flex items-center gap-1 text-gray-500">
                <AlertTriangle className="w-4 h-4" />
                Unknown
            </span>
        );
    }
    return (
        <span className="flex items-center gap-1 text-red-600">
            <XCircle className="w-4 h-4" />
            Error
        </span>
    );
}

function formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

export function SettingsPage() {
    const { data: status, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['system-status'],
        queryFn: () => api.get<SystemStatus>('/system'),
        refetchInterval: 30000, // Refresh every 30s
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-gray-400" />
                        System Settings
                    </h2>
                    <p className="text-sm text-gray-500">
                        Phase 5 system health and configuration
                    </p>
                </div>
                <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Status Cards */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Vector Database */}
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Database className="w-5 h-5 text-blue-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900">Vector Database</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Provider</span>
                            <span className="font-medium font-mono">{status?.vectorDb.provider}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Status</span>
                            <StatusBadge status={status?.vectorDb.status || 'unknown'} />
                        </div>
                        {status?.vectorDb.provider === 'qdrant' && (
                            <div className="flex justify-between">
                                <span className="text-gray-500">Qdrant Connected</span>
                                <StatusBadge status={status?.vectorDb.qdrantConnected} />
                            </div>
                        )}
                    </div>
                </div>

                {/* AI Worker */}
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <Cpu className="w-5 h-5 text-purple-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900">AI Worker</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Status</span>
                            <StatusBadge status={status?.aiWorker.status || 'unknown'} />
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Hybrid Embeddings</span>
                            <StatusBadge status={status?.aiWorker.hybridEmbeddings ?? false} />
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">URL</span>
                            <span className="font-mono text-xs text-gray-600 truncate max-w-[150px]">
                                {status?.aiWorker.url}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Security */}
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-50 rounded-lg">
                            <Lock className="w-5 h-5 text-green-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900">Security</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Encryption</span>
                            <StatusBadge status={status?.encryption.configured ?? false} />
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Algorithm</span>
                            <span className="font-mono text-xs">{status?.encryption.algorithm}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">OAuth Configured</span>
                            <StatusBadge status={status?.oauth.configured ?? false} />
                        </div>
                    </div>
                </div>

                {/* System */}
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-gray-100 rounded-lg">
                            <Server className="w-5 h-5 text-gray-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900">System</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Version</span>
                            <span className="font-mono">{status?.version}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Uptime</span>
                            <span className="font-mono">{status ? formatUptime(status.uptime) : '-'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Environment Hint */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700">
                <p className="font-medium mb-1">Environment Variables</p>
                <p className="text-blue-600">
                    Configure <code className="bg-blue-100 px-1 rounded">VECTOR_DB_PROVIDER=qdrant</code> to enable Qdrant search.
                    Ensure <code className="bg-blue-100 px-1 rounded">APP_ENCRYPTION_KEY</code> is set for OAuth token encryption.
                </p>
            </div>
        </div>
    );
}
