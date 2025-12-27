import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/endpoints';

export function useAnalyticsOverview() {
    return useQuery({
        queryKey: ['analytics', 'overview'],
        queryFn: () => analyticsApi.getOverview(),
        staleTime: 30000, // 30 seconds
    });
}

export function useAnalyticsProcessing(format?: string) {
    return useQuery({
        queryKey: ['analytics', 'processing', format],
        queryFn: () => analyticsApi.getProcessing(format),
        staleTime: 30000,
    });
}

export function useAnalyticsQuality() {
    return useQuery({
        queryKey: ['analytics', 'quality'],
        queryFn: () => analyticsApi.getQuality(),
        staleTime: 30000,
    });
}

export function useAnalyticsDocuments(params?: { page?: number; limit?: number }) {
    return useQuery({
        queryKey: ['analytics', 'documents', params],
        queryFn: () => analyticsApi.getDocuments(params),
        staleTime: 30000,
    });
}

export function useDocumentChunks(documentId: string | null) {
    return useQuery({
        queryKey: ['analytics', 'document-chunks', documentId],
        queryFn: () => documentId ? analyticsApi.getDocumentChunks(documentId) : Promise.resolve(null),
        enabled: !!documentId,
        staleTime: 30000,
    });
}
