/**
 * Add Folder Modal
 * 
 * Opens Google Drive Picker for folder selection.
 * Uses friendly sync frequency dropdown instead of cron input.
 */

import { Loader2, X, FolderOpen, CheckCircle, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useDrivePicker, PickerResult } from '@/hooks/useDrivePicker';
import { SyncFrequencySelect } from './SyncFrequencySelect';

interface AddFolderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { folderId: string; folderName: string; syncCron: string; recursive: boolean }) => Promise<void>;
    isLoading?: boolean;
}

export function AddFolderModal({ isOpen, onClose, onSubmit, isLoading = false }: AddFolderModalProps) {
    const [selectedFolder, setSelectedFolder] = useState<PickerResult | null>(null);
    const [syncCron, setSyncCron] = useState('0 */6 * * *');
    const [recursive, setRecursive] = useState(true);
    const { openPicker, isLoading: pickerLoading, error: pickerError } = useDrivePicker();

    if (!isOpen) return null;

    const handleOpenPicker = async () => {
        const result = await openPicker();
        if (result) {
            setSelectedFolder(result);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFolder) return;

        await onSubmit({
            folderId: selectedFolder.folderId,
            folderName: selectedFolder.folderName,
            syncCron,
            recursive,
        });

        // Reset form on success
        setSelectedFolder(null);
        setSyncCron('0 */6 * * *');
    };

    const handleClose = () => {
        setSelectedFolder(null);
        setSyncCron('0 */6 * * *');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Add Google Drive Folder</h3>
                    <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="text-gray-400 hover:text-gray-500 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Folder Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Folder <span className="text-red-500">*</span>
                        </label>

                        {selectedFolder ? (
                            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {selectedFolder.folderName}
                                    </p>
                                    <p className="text-xs text-gray-500 font-mono truncate">
                                        {selectedFolder.folderId}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedFolder(null)}
                                    disabled={isLoading}
                                    className="text-sm text-gray-500 hover:text-gray-700"
                                >
                                    Change
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={handleOpenPicker}
                                disabled={pickerLoading || isLoading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {pickerLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                ) : (
                                    <FolderOpen className="w-5 h-5 text-gray-400" />
                                )}
                                <span className="text-sm font-medium text-gray-600">
                                    {pickerLoading ? 'Opening...' : 'Select Folder from Drive'}
                                </span>
                            </button>
                        )}

                        {pickerError && (
                            <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                                <AlertCircle className="w-4 h-4" />
                                {pickerError}
                            </div>
                        )}
                    </div>

                    {/* Sync Frequency */}
                    <SyncFrequencySelect
                        value={syncCron}
                        onChange={setSyncCron}
                        disabled={isLoading}
                    />

                    {/* Recursive */}
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

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !selectedFolder}
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
