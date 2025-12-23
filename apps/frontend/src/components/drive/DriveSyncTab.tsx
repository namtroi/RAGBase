import { driveApi } from '@/api/endpoints';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { AddFolderModal } from './AddFolderModal';
import { DriveConfigList } from './DriveConfigList';

export function DriveSyncTab() {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const queryClient = useQueryClient();

    // Fetch configs
    const { data, isLoading } = useQuery({
        queryKey: ['driveConfigs'],
        queryFn: driveApi.listConfigs,
        refetchInterval: 5000, // Poll every 5s for sync status updates
    });

    // Create mutation
    const createMutation = useMutation({
        mutationFn: driveApi.createConfig,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['driveConfigs'] });
            setIsAddModalOpen(false);
        },
    });

    const handleCreate = async (data: { folderId: string; syncCron: string; recursive: boolean }) => {
        await createMutation.mutateAsync({
            folderId: data.folderId,
            syncCron: data.syncCron || undefined, // Allow empty to use default
            recursive: data.recursive,
            enabled: true,
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
        );
    }

    const configs = data?.configs || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Google Drive Sync</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Connect folder from Google Drive to automatically sync documents.
                    </p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add Folder
                </button>
            </div>

            {/* List */}
            <DriveConfigList configs={configs} />

            {/* Modal */}
            <AddFolderModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSubmit={handleCreate}
                isLoading={createMutation.isPending}
            />
        </div>
    );
}
