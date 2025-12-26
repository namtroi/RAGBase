import { ChunkDetail, chunksApi, ChunksListParams } from '@/api/endpoints';
import { Pagination } from '@/components/documents/pagination';
import { useQuery } from '@tanstack/react-query';
import { FileText, Layers, X } from 'lucide-react';
import { useState } from 'react';
import { ChunkCard } from './ChunkCard';
import { ChunkFilterState, ChunkFilters } from './ChunkFilters';

const defaultFilters: ChunkFilterState = {
    search: '',
    quality: '',
    type: '',
};

// Quality color helper
function getQualityColor(score: number | null): { bg: string; text: string } {
    if (score === null) return { bg: 'bg-gray-100', text: 'text-gray-600' };
    if (score >= 0.85) return { bg: 'bg-emerald-100', text: 'text-emerald-700' };
    if (score >= 0.70) return { bg: 'bg-blue-100', text: 'text-blue-700' };
    return { bg: 'bg-amber-100', text: 'text-amber-700' };
}

// Modal component for chunk details
function ChunkDetailModal({ chunk, onClose }: { chunk: ChunkDetail; onClose: () => void }) {
    const qualityColors = getQualityColor(chunk.qualityScore);

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Chunk Details</h3>
                        <p className="text-sm text-gray-500">
                            {chunk.document.filename} › Chunk #{chunk.index}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[calc(85vh-80px)] space-y-4">
                    {/* Metadata grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 rounded-lg p-4">
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Quality Score</p>
                            <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${qualityColors.bg} ${qualityColors.text}`}>
                                {chunk.qualityScore !== null ? `${(chunk.qualityScore * 100).toFixed(0)}%` : 'N/A'}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Type</p>
                            <p className="font-medium text-gray-900">{chunk.chunkType || 'document'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Tokens</p>
                            <p className="font-medium text-gray-900">{chunk.tokenCount || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Position</p>
                            <p className="font-medium text-gray-900">{chunk.charStart} - {chunk.charEnd}</p>
                        </div>
                    </div>

                    {/* Breadcrumbs */}
                    {chunk.breadcrumbs && (
                        <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-xs text-blue-600 font-medium mb-1">Breadcrumbs</p>
                            <p className="text-blue-800">{chunk.breadcrumbs}</p>
                        </div>
                    )}

                    {/* Quality flags */}
                    {chunk.qualityFlags && chunk.qualityFlags.length > 0 && (
                        <div>
                            <p className="text-xs text-gray-500 mb-2">Quality Flags</p>
                            <div className="flex flex-wrap gap-2">
                                {chunk.qualityFlags.map((flag) => (
                                    <span key={flag} className="px-2 py-1 text-xs rounded bg-amber-100 text-amber-700">
                                        {flag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    <div>
                        <p className="text-xs text-gray-500 mb-2">Content</p>
                        <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-auto">
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                                {chunk.content}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function ChunksExplorerPage() {
    const [filters, setFilters] = useState<ChunkFilterState>(defaultFilters);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);

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

    // Fetch selected chunk detail
    const { data: selectedChunk } = useQuery({
        queryKey: ['chunks', 'detail', selectedChunkId],
        queryFn: () => selectedChunkId ? chunksApi.get(selectedChunkId) : null,
        enabled: !!selectedChunkId,
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
                counts={undefined} // TODO: Add counts from API
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
                            onViewDetails={setSelectedChunkId}
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

            {/* Detail Modal */}
            {selectedChunk && (
                <ChunkDetailModal
                    chunk={selectedChunk}
                    onClose={() => setSelectedChunkId(null)}
                />
            )}
        </div>
    );
}
