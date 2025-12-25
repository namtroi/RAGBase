import { documentsApi, ListResponse } from '@/api/endpoints';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Loader } from 'lucide-react';

interface AvailabilityToggleProps {
    documentId: string;
    isActive: boolean;
    disabled?: boolean;
}

export function AvailabilityToggle({ documentId, isActive, disabled }: AvailabilityToggleProps) {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: (newValue: boolean) => documentsApi.toggleAvailability(documentId, newValue),
        onMutate: async (newValue) => {
            // Cancel any outgoing refetches to prevent them from overwriting our optimistic update
            await queryClient.cancelQueries({ queryKey: ['documents'] });

            // Snapshot the previous value
            const previousData = queryClient.getQueryData<ListResponse>(['documents']);

            // Optimistically update the cache
            queryClient.setQueryData<ListResponse>(['documents'], (old) => {
                if (!old) return old;
                
                return {
                    ...old,
                    documents: old.documents.map(doc =>
                        doc.id === documentId
                            ? { ...doc, isActive: newValue }
                            : doc
                    ),
                };
            });

            // Return context with previous data for rollback
            return { previousData };
        },
        onError: (_err, _newValue, context) => {
            // Rollback to previous data on error
            if (context?.previousData) {
                queryClient.setQueryData(['documents'], context.previousData);
            }
        },
        onSuccess: () => {
            // Refetch to sync with server state
            queryClient.invalidateQueries({ queryKey: ['documents'] });
        },
    });

    const isLoading = mutation.isPending;

    const handleToggle = () => {
        if (!disabled && !isLoading) {
            mutation.mutate(!isActive);
        }
    };

    return (
        <button
            type="button"
            role="switch"
            aria-checked={isActive}
            disabled={disabled || isLoading}
            onClick={handleToggle}
            className={clsx(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                isActive ? 'bg-primary-500' : 'bg-gray-200',
                (disabled || isLoading) && 'opacity-50 cursor-not-allowed'
            )}
            title={disabled ? 'Only completed documents can be toggled' : isActive ? 'Active' : 'Inactive'}
        >
            <span
                className={clsx(
                    'pointer-events-none relative inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    isActive ? 'translate-x-4' : 'translate-x-0'
                )}
            >
                {isLoading && (
                    <Loader className="absolute inset-0 m-auto w-3 h-3 animate-spin text-gray-400" />
                )}
            </span>
        </button>
    );
}
