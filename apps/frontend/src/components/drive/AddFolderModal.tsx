import { Loader2, X } from 'lucide-react';
import { useState } from 'react';

interface AddFolderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { folderId: string; syncCron: string; recursive: boolean }) => Promise<void>;
    isLoading?: boolean;
}

export function AddFolderModal({ isOpen, onClose, onSubmit, isLoading = false }: AddFolderModalProps) {
    const [folderId, setFolderId] = useState('');
    const [syncCron, setSyncCron] = useState('0 */6 * * *');
    const [recursive, setRecursive] = useState(true);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!folderId.trim()) return;

        await onSubmit({
            folderId: folderId.trim(),
            syncCron,
            recursive,
        });

        // Reset form on success (onSubmit should handle errors)
        setFolderId('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Add Google Drive Folder</h3>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="text-gray-400 hover:text-gray-500 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="folderId" className="block text-sm font-medium text-gray-700 mb-1">
                            Folder ID <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="folderId"
                            type="text"
                            value={folderId}
                            onChange={(e) => setFolderId(e.target.value)}
                            placeholder="e.g., 1A2B3C..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                            required
                            disabled={isLoading}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            The ID from the Google Drive URL: drive.google.com/drive/folders/<b>ID</b>
                        </p>
                    </div>

                    <div>
                        <label htmlFor="syncCron" className="block text-sm font-medium text-gray-700 mb-1">
                            Sync Schedule (Cron)
                        </label>
                        <input
                            id="syncCron"
                            type="text"
                            value={syncCron}
                            onChange={(e) => setSyncCron(e.target.value)}
                            placeholder="0 */6 * * *"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                            disabled={isLoading}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Default: Every 6 hours (0 */6 * * *)
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            id="recursive"
                            type="checkbox"
                            checked={recursive}
                            onChange={(e) => setRecursive(e.target.checked)}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            disabled={isLoading}
                        />
                        <label htmlFor="recursive" className="text-sm font-medium text-gray-700">
                            Sync recursively (include subfolders)
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !folderId.trim()}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Add Folder
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
