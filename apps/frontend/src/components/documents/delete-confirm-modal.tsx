import { documentsApi } from '@/api/endpoints';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useState } from 'react';

interface DeleteConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    documents: Array<{ id: string; filename: string }>;
    onSuccess: () => void;
}

export function DeleteConfirmModal({
    isOpen,
    onClose,
    documents,
    onSuccess,
}: DeleteConfirmModalProps) {
    const queryClient = useQueryClient();
    const [isDeleting, setIsDeleting] = useState(false);

    const deleteMutation = useMutation({
        mutationFn: () => documentsApi.bulkDelete(documents.map((d) => d.id)),
        onMutate: () => setIsDeleting(true),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            onSuccess();
            onClose();
        },
        onSettled: () => setIsDeleting(false),
    });

    if (!isOpen) return null;

    const displayLimit = 5;
    const displayDocs = documents.slice(0, displayLimit);
    const remainingCount = documents.length - displayLimit;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-100 rounded-full">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Delete Documents</h3>
                        <p className="text-sm text-gray-500">
                            This action cannot be undone.
                        </p>
                    </div>
                </div>

                {/* Document list */}
                <div className="mb-6">
                    <p className="text-sm text-gray-700 mb-2">
                        You are about to permanently delete{' '}
                        <span className="font-semibold">{documents.length}</span> document
                        {documents.length !== 1 ? 's' : ''}:
                    </p>
                    <ul className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                        {displayDocs.map((doc) => (
                            <li key={doc.id} className="truncate text-gray-600">
                                • {doc.filename}
                            </li>
                        ))}
                        {remainingCount > 0 && (
                            <li className="text-gray-500 italic">
                                ...and {remainingCount} more
                            </li>
                        )}
                    </ul>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => deleteMutation.mutate()}
                        disabled={isDeleting}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors',
                            'bg-red-600 hover:bg-red-700 disabled:opacity-50'
                        )}
                    >
                        {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                        Delete {documents.length} document{documents.length !== 1 ? 's' : ''}
                    </button>
                </div>
            </div>
        </div>
    );
}
