import { documentsApi } from '@/api/endpoints';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { CheckSquare, Loader2, Power, PowerOff, RefreshCw, Trash2, X } from 'lucide-react';
import { useState } from 'react';

interface BulkActionBarProps {
    selectedIds: string[];
    selectedDocuments: Array<{ id: string; filename: string; status: string }>;
    onClear: () => void;
    onDeleteConfirm: () => void;
}

export function BulkActionBar({
    selectedIds,
    selectedDocuments,
    onClear,
    onDeleteConfirm,
}: BulkActionBarProps) {
    const queryClient = useQueryClient();
    const [activeOp, setActiveOp] = useState<string | null>(null);

    const setActiveMutation = useMutation({
        mutationFn: () => documentsApi.bulkToggleAvailability(selectedIds, true),
        onMutate: () => setActiveOp('activate'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            onClear();
        },
        onSettled: () => setActiveOp(null),
    });

    const setInactiveMutation = useMutation({
        mutationFn: () => documentsApi.bulkToggleAvailability(selectedIds, false),
        onMutate: () => setActiveOp('deactivate'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            onClear();
        },
        onSettled: () => setActiveOp(null),
    });

    const retryMutation = useMutation({
        mutationFn: () => documentsApi.bulkRetry(selectedIds),
        onMutate: () => setActiveOp('retry'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            onClear();
        },
        onSettled: () => setActiveOp(null),
    });

    const failedCount = selectedDocuments.filter((d) => d.status === 'FAILED').length;
    const isLoading = activeOp !== null;

    if (selectedIds.length === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <div className="bg-gray-900 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-4">
                {/* Selection count */}
                <div className="flex items-center gap-2 pr-4 border-r border-gray-700">
                    <CheckSquare className="w-4 h-4 text-primary-400" />
                    <span className="text-sm font-medium">{selectedIds.length} selected</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveMutation.mutate()}
                        disabled={isLoading}
                        className={clsx(
                            'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors',
                            'bg-green-600 hover:bg-green-500 disabled:opacity-50'
                        )}
                    >
                        {activeOp === 'activate' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Power className="w-4 h-4" />
                        )}
                        Activate
                    </button>

                    <button
                        onClick={() => setInactiveMutation.mutate()}
                        disabled={isLoading}
                        className={clsx(
                            'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors',
                            'bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50'
                        )}
                    >
                        {activeOp === 'deactivate' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <PowerOff className="w-4 h-4" />
                        )}
                        Deactivate
                    </button>

                    {failedCount > 0 && (
                        <button
                            onClick={() => retryMutation.mutate()}
                            disabled={isLoading}
                            className={clsx(
                                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors',
                                'bg-blue-600 hover:bg-blue-500 disabled:opacity-50'
                            )}
                        >
                            {activeOp === 'retry' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4" />
                            )}
                            Retry ({failedCount})
                        </button>
                    )}

                    <button
                        onClick={onDeleteConfirm}
                        disabled={isLoading}
                        className={clsx(
                            'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors',
                            'bg-red-600 hover:bg-red-500 disabled:opacity-50'
                        )}
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete
                    </button>
                </div>

                {/* Clear */}
                <button
                    onClick={onClear}
                    disabled={isLoading}
                    className="ml-2 p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors"
                    title="Clear selection"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
