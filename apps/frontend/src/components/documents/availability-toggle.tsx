import { documentsApi } from '@/api/endpoints';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Loader } from 'lucide-react';
import { useState } from 'react';

interface AvailabilityToggleProps {
    documentId: string;
    isActive: boolean;
    disabled?: boolean;
}

export function AvailabilityToggle({ documentId, isActive, disabled }: AvailabilityToggleProps) {
    const [optimisticValue, setOptimisticValue] = useState<boolean | null>(null);
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: (newValue: boolean) => documentsApi.toggleAvailability(documentId, newValue),
        onMutate: async (newValue) => {
            setOptimisticValue(newValue);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents'] });
        },
        onError: () => {
            setOptimisticValue(null); // Revert on error
        },
        onSettled: () => {
            setOptimisticValue(null);
        },
    });

    const currentValue = optimisticValue !== null ? optimisticValue : isActive;
    const isLoading = mutation.isPending;

    const handleToggle = () => {
        if (!disabled && !isLoading) {
            mutation.mutate(!currentValue);
        }
    };

    return (
        <button
            type="button"
            role="switch"
            aria-checked={currentValue}
            disabled={disabled || isLoading}
            onClick={handleToggle}
            className={clsx(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                currentValue ? 'bg-primary-500' : 'bg-gray-200',
                (disabled || isLoading) && 'opacity-50 cursor-not-allowed'
            )}
            title={disabled ? 'Only completed documents can be toggled' : currentValue ? 'Active' : 'Inactive'}
        >
            <span
                className={clsx(
                    'pointer-events-none relative inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    currentValue ? 'translate-x-4' : 'translate-x-0'
                )}
            >
                {isLoading && (
                    <Loader className="absolute inset-0 m-auto w-3 h-3 animate-spin text-gray-400" />
                )}
            </span>
        </button>
    );
}
