import { chunksApi, ChunksListParams } from '@/api/endpoints';
import { Pagination } from '@/components/documents/pagination';
import { useQuery } from '@tanstack/react-query';
import { FileText, Layers } from 'lucide-react';
import { useState } from 'react';
import { ChunkCard } from './ChunkCard';
import { ChunkFilterState, ChunkFilters } from './ChunkFilters';

const defaultFilters: ChunkFilterState = {
    search: '',
    quality: '',
    type: '',
};

export function ChunksExplorerPage() {
    const [filters, setFilters] = useState<ChunkFilterState>(defaultFilters);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // Build query params
    const queryParams: ChunksListParams = {
        page,
        limit: pageSize,
        quality: filters.quality || undefined,
        type: filters.type || undefined,
        search: filters.search || undefined,
    };

    // Fetch chunks list
    const { data, isLoading } = useQuery({
        queryKey: ['chunks', 'list', queryParams],
        queryFn: () => chunksApi.list(queryParams),
        staleTime: 30000,
    });

    const handleFilterChange = (newFilters: ChunkFilterState) => {
        setFilters(newFilters);
        setPage(1);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-gray-400" />
                        Chunks Explorer
                    </h2>
                    <p className="text-sm text-gray-500">Browse and inspect document chunks</p>
                </div>
            </div>

            {/* Filters */}
            <ChunkFilters
                filters={filters}
                onChange={handleFilterChange}
                counts={undefined}
            />

            {/* Summary */}
            {data && (
                <div className="flex gap-4 text-xs text-gray-500">
                    <span>Total: {data.pagination.total} chunks</span>
                </div>
            )}

            {/* Chunk list */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-primary-500 rounded-full" />
                </div>
            ) : data?.chunks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No chunks found</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {data?.chunks.map((chunk) => (
                        <ChunkCard
                            key={chunk.id}
                            chunk={chunk}
                        />
                    ))}
                </div>
            )}

            {/* Pagination */}
            {data && data.pagination.total > 0 && (
                <Pagination
                    total={data.pagination.total}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(newSize) => {
                        setPageSize(newSize);
                        setPage(1);
                    }}
                />
            )}
        </div>
    );
}
