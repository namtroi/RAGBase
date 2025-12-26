import { Card, Text, Badge, TextInput, Select, SelectItem, Button, Flex } from '@tremor/react';
import { useChunksList, useChunkDetail } from '@/hooks/use-chunks';
import { ChunksListParams, ChunkListItem } from '@/api/endpoints';
import { useState } from 'react';
import { Search, FileText, ChevronLeft, ChevronRight, X, Eye } from 'lucide-react';

function getQualityColor(score: number | null): string {
    if (score === null) return 'gray';
    if (score >= 0.85) return 'emerald';
    if (score >= 0.70) return 'blue';
    return 'amber';
}

interface ChunkCardProps {
    chunk: ChunkListItem;
    onViewDetails: (id: string) => void;
}

function ChunkCard({ chunk, onViewDetails }: ChunkCardProps) {
    const qualityColor = getQualityColor(chunk.qualityScore);
    const truncatedContent = chunk.content.length > 200
        ? chunk.content.substring(0, 200) + '...'
        : chunk.content;

    return (
        <Card className="p-4 hover:shadow-md transition-shadow">
            <Flex className="justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                    <Flex className="items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                        <Text className="font-medium text-gray-700 truncate">
                            {chunk.document.filename}
                        </Text>
                        <Text className="text-gray-400">›</Text>
                        <Text className="text-gray-500">Chunk #{chunk.chunkIndex}</Text>
                    </Flex>
                    <Text className="text-gray-600 text-sm leading-relaxed">
                        {truncatedContent}
                    </Text>
                    <Flex className="items-center gap-3 mt-3">
                        {chunk.chunkType && (
                            <Badge size="xs" color="gray">{chunk.chunkType}</Badge>
                        )}
                        {chunk.tokenCount && (
                            <Text className="text-xs text-gray-400">
                                {chunk.tokenCount} tokens
                            </Text>
                        )}
                        {chunk.qualityFlags?.map((flag) => (
                            <Badge key={flag} size="xs" color="amber">{flag}</Badge>
                        ))}
                    </Flex>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <Badge size="lg" color={qualityColor}>
                        {chunk.qualityScore !== null ? `${(chunk.qualityScore * 100).toFixed(0)}%` : 'N/A'}
                    </Badge>
                    <Button
                        size="xs"
                        variant="secondary"
                        icon={Eye}
                        onClick={() => onViewDetails(chunk.id)}
                    >
                        Details
                    </Button>
                </div>
            </Flex>
        </Card>
    );
}

interface ChunkDetailModalProps {
    chunkId: string;
    onClose: () => void;
}

function ChunkDetailModal({ chunkId, onClose }: ChunkDetailModalProps) {
    const { data: chunk, isLoading } = useChunkDetail(chunkId);

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <Card className="w-full max-w-2xl mx-4 p-6">
                    <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    </div>
                </Card>
            </div>
        );
    }

    if (!chunk) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <Card className="w-full max-w-3xl mx-4 max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
                <Flex className="justify-between items-start mb-4">
                    <div>
                        <Text className="text-lg font-semibold text-gray-800">Chunk Details</Text>
                        <Text className="text-gray-500">{chunk.document.filename} › Chunk #{chunk.chunkIndex}</Text>
                    </div>
                    <Button size="xs" variant="light" icon={X} onClick={onClose}>Close</Button>
                </Flex>

                <div className="space-y-4">
                    {/* Metadata */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 rounded-lg p-4">
                        <div>
                            <Text className="text-xs text-gray-500">Quality Score</Text>
                            <Badge size="lg" color={getQualityColor(chunk.qualityScore)}>
                                {chunk.qualityScore !== null ? `${(chunk.qualityScore * 100).toFixed(0)}%` : 'N/A'}
                            </Badge>
                        </div>
                        <div>
                            <Text className="text-xs text-gray-500">Type</Text>
                            <Text className="font-medium">{chunk.chunkType || 'document'}</Text>
                        </div>
                        <div>
                            <Text className="text-xs text-gray-500">Tokens</Text>
                            <Text className="font-medium">{chunk.tokenCount || 'N/A'}</Text>
                        </div>
                        <div>
                            <Text className="text-xs text-gray-500">Position</Text>
                            <Text className="font-medium">{chunk.charStart} - {chunk.charEnd}</Text>
                        </div>
                    </div>

                    {/* Breadcrumb */}
                    {chunk.breadcrumb && (
                        <div className="bg-blue-50 rounded-lg p-3">
                            <Text className="text-xs text-blue-600 font-medium">Breadcrumb</Text>
                            <Text className="text-blue-800">{chunk.breadcrumb}</Text>
                        </div>
                    )}

                    {/* Quality Flags */}
                    {chunk.qualityFlags && chunk.qualityFlags.length > 0 && (
                        <div>
                            <Text className="text-xs text-gray-500 mb-2">Quality Flags</Text>
                            <Flex className="gap-2 flex-wrap">
                                {chunk.qualityFlags.map((flag) => (
                                    <Badge key={flag} color="amber">{flag}</Badge>
                                ))}
                            </Flex>
                        </div>
                    )}

                    {/* Content */}
                    <div>
                        <Text className="text-xs text-gray-500 mb-2">Content</Text>
                        <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-auto">
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                                {chunk.content}
                            </pre>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}

export function ChunksExplorerPage() {
    const [params, setParams] = useState<ChunksListParams>({ page: 1, limit: 20 });
    const [search, setSearch] = useState('');
    const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);

    const { data, isLoading } = useChunksList(params);

    const handleSearch = () => {
        setParams(prev => ({ ...prev, search: search || undefined, page: 1 }));
    };

    const handleFilterChange = (key: keyof ChunksListParams, value: string) => {
        setParams(prev => ({
            ...prev,
            [key]: value === 'all' ? undefined : value,
            page: 1
        }));
    };

    const handlePageChange = (newPage: number) => {
        setParams(prev => ({ ...prev, page: newPage }));
    };

    const totalPages = data?.pagination.totalPages || 1;
    const currentPage = data?.pagination.page || 1;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-xl font-bold text-gray-900">🔍 Chunks Explorer</h2>
                <Text className="text-gray-500">Browse and inspect document chunks</Text>
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="md:col-span-2">
                        <TextInput
                            placeholder="Search chunks..."
                            icon={Search}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <Select
                        placeholder="Quality"
                        onValueChange={(value) => handleFilterChange('quality', value)}
                    >
                        <SelectItem value="all">All Quality</SelectItem>
                        <SelectItem value="excellent">Excellent (≥85%)</SelectItem>
                        <SelectItem value="good">Good (70-84%)</SelectItem>
                        <SelectItem value="low">Low (&lt;70%)</SelectItem>
                    </Select>
                    <Select
                        placeholder="Type"
                        onValueChange={(value) => handleFilterChange('type', value)}
                    >
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="document">Document</SelectItem>
                        <SelectItem value="presentation">Presentation</SelectItem>
                        <SelectItem value="tabular">Tabular</SelectItem>
                    </Select>
                    <Button onClick={handleSearch}>Search</Button>
                </div>
            </Card>

            {/* Results */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
            ) : (
                <>
                    <Flex className="justify-between items-center">
                        <Text className="text-gray-500">
                            Showing {((currentPage - 1) * (params.limit || 20)) + 1}-
                            {Math.min(currentPage * (params.limit || 20), data?.pagination.total || 0)} of {data?.pagination.total || 0} chunks
                        </Text>
                    </Flex>

                    <div className="space-y-3">
                        {data?.chunks.map((chunk) => (
                            <ChunkCard
                                key={chunk.id}
                                chunk={chunk}
                                onViewDetails={setSelectedChunkId}
                            />
                        ))}
                    </div>

                    {data?.chunks.length === 0 && (
                        <Card className="p-8 text-center">
                            <Text className="text-gray-500">No chunks found matching your criteria</Text>
                        </Card>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <Flex className="justify-center items-center gap-2">
                            <Button
                                size="xs"
                                variant="secondary"
                                icon={ChevronLeft}
                                disabled={currentPage <= 1}
                                onClick={() => handlePageChange(currentPage - 1)}
                            >
                                Prev
                            </Button>
                            <Text className="text-gray-600">
                                Page {currentPage} of {totalPages}
                            </Text>
                            <Button
                                size="xs"
                                variant="secondary"
                                icon={ChevronRight}
                                iconPosition="right"
                                disabled={currentPage >= totalPages}
                                onClick={() => handlePageChange(currentPage + 1)}
                            >
                                Next
                            </Button>
                        </Flex>
                    )}
                </>
            )}

            {/* Detail Modal */}
            {selectedChunkId && (
                <ChunkDetailModal
                    chunkId={selectedChunkId}
                    onClose={() => setSelectedChunkId(null)}
                />
            )}
        </div>
    );
}
