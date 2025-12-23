import { DriveConfig, driveApi } from '@/api/endpoints';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
    AlertCircle,
    CheckCircle,
    FolderSync,
    Loader2,
    RefreshCw,
    Trash2
} from 'lucide-react';
import { useState } from 'react';

interface DriveConfigListProps {
    configs: DriveConfig[];
}

export function DriveConfigList({ configs }: DriveConfigListProps) {
    const queryClient = useQueryClient();
    const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

    // Mutation to delete config
    const deleteMutation = useMutation({
        mutationFn: driveApi.deleteConfig,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['driveConfigs'] });
        },
    });

    // Mutation to trigger sync
    const syncMutation = useMutation({
        mutationFn: driveApi.triggerSync,
        onMutate: (configId) => {
            setSyncingIds((prev) => new Set(prev).add(configId));
        },
        onSuccess: () => {
            // Invalidate to update status
            queryClient.invalidateQueries({ queryKey: ['driveConfigs'] });
        },
        onSettled: (_, __, configId) => {
            // Remove loading state after a delay or immediately
            // For UX we keep spinning until we get success, but actual sync takes time
            // The status will update to 'SYNCING' on refresh
            setTimeout(() => {
                setSyncingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(configId);
                    return next;
                });
            }, 1000);
        },
    });

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to remove this folder? Syncing will stop.')) {
            await deleteMutation.mutateAsync(id);
        }
    };

    const handleSync = async (id: string) => {
        await syncMutation.mutateAsync(id);
    };

    if (configs.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                <FolderSync className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No folders connected</h3>
                <p className="text-gray-500 mt-2">Connect a Google Drive folder to start syncing documents.</p>
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Folder Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Sync Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Docs
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Last Sync
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {configs.map((config) => (
                            <tr key={config.id} className="hover:bg-gray-50 transition-colors">
                                {/* Folder Info */}
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <FolderSync className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{config.folderName}</p>
                                            <p className="text-xs text-gray-500 font-mono">ID: {config.folderId}</p>
                                        </div>
                                    </div>
                                </td>

                                {/* Status */}
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        {config.syncStatus === 'SYNCING' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                Syncing
                                            </span>
                                        ) : config.syncStatus === 'ERROR' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800" title={config.syncError}>
                                                <AlertCircle className="w-3 h-3" />
                                                Error
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <CheckCircle className="w-3 h-3" />
                                                Idle
                                            </span>
                                        )}
                                    </div>
                                    {config.syncError && (
                                        <p className="mt-1 text-xs text-red-600 max-w-[200px] truncate">{config.syncError}</p>
                                    )}
                                </td>

                                {/* Docs Count */}
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {config.documentCount || 0}
                                </td>

                                {/* Last Sync */}
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {config.lastSyncedAt
                                        ? format(new Date(config.lastSyncedAt), 'MMM d, HH:mm')
                                        : 'Never'}
                                </td>

                                {/* Actions */}
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleSync(config.id)}
                                            disabled={config.syncStatus === 'SYNCING' || syncingIds.has(config.id)}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
                                            title="Sync Now"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${syncingIds.has(config.id) ? 'animate-spin' : ''}`} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(config.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                            title="Remove Folder"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
