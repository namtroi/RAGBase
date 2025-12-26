import { useQuery } from '@tanstack/react-query';
import { chunksApi, ChunksListParams } from '@/api/endpoints';

export function useChunksList(params?: ChunksListParams) {
    return useQuery({
        queryKey: ['chunks', 'list', params],
        queryFn: () => chunksApi.list(params),
        staleTime: 30000,
    });
}

export function useChunkDetail(id: string | null) {
    return useQuery({
        queryKey: ['chunks', 'detail', id],
        queryFn: () => id ? chunksApi.get(id) : Promise.resolve(null),
        enabled: !!id,
        staleTime: 60000, // 1 minute
    });
}
