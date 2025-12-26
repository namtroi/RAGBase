import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/endpoints';

export type Period = '24h' | '7d' | '30d' | 'all';

export function useAnalyticsOverview(period: Period = '7d') {
    return useQuery({
        queryKey: ['analytics', 'overview', period],
        queryFn: () => analyticsApi.getOverview(period),
        staleTime: 30000, // 30 seconds
    });
}

export function useAnalyticsProcessing(period: Period = '7d') {
    return useQuery({
        queryKey: ['analytics', 'processing', period],
        queryFn: () => analyticsApi.getProcessing(period),
        staleTime: 30000,
    });
}

export function useAnalyticsQuality(period: Period = '7d') {
    return useQuery({
        queryKey: ['analytics', 'quality', period],
        queryFn: () => analyticsApi.getQuality(period),
        staleTime: 30000,
    });
}

export function useAnalyticsDocuments(params?: { page?: number; limit?: number; period?: string }) {
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
