import { ChunkListItem } from '@/api/endpoints';
import clsx from 'clsx';
import { Eye, FileText, Hash, Layers } from 'lucide-react';

interface ChunkCardProps {
    chunk: ChunkListItem;
    onViewDetails: (id: string) => void;
}

function getQualityColor(score: number | null): { bg: string; text: string; border: string } {
    if (score === null) return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
    if (score >= 0.85) return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' };
    if (score >= 0.70) return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' };
    return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' };
}

function getQualityLabel(score: number | null): string {
    if (score === null) return 'N/A';
    if (score >= 0.85) return 'Excellent';
    if (score >= 0.70) return 'Good';
    return 'Low';
}

export function ChunkCard({ chunk, onViewDetails }: ChunkCardProps) {
    const qualityColors = getQualityColor(chunk.qualityScore);
    const truncatedContent = chunk.content.length > 180
        ? chunk.content.substring(0, 180) + '...'
        : chunk.content;

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4">
                {/* Left side: Content */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                        {/* Header: filename > chunk index */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-gray-900 truncate">{chunk.filename}</h3>
                            <span className="text-gray-400">›</span>
                            <span className="text-gray-500 text-sm">Chunk #{chunk.index}</span>
                        </div>

                        {/* Metadata row */}
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                                <Hash className="w-3 h-3" />
                                <span className="font-mono">{chunk.id.slice(0, 8)}...</span>
                            </span>
                            {chunk.tokenCount && (
                                <span>{chunk.tokenCount} tokens</span>
                            )}
                            {chunk.chunkType && (
                                <span className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                    <Layers className="w-3 h-3" />
                                    {chunk.chunkType}
                                </span>
                            )}
                        </div>

                        {/* Content preview */}
                        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                            {truncatedContent}
                        </p>

                        {/* Quality flags */}
                        {chunk.qualityFlags && chunk.qualityFlags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {chunk.qualityFlags.map((flag) => (
                                    <span
                                        key={flag}
                                        className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700"
                                    >
                                        {flag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right side: Quality + Actions */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                    {/* Quality badge */}
                    <div className={clsx(
                        'px-2.5 py-1 rounded-lg text-sm font-semibold border',
                        qualityColors.bg,
                        qualityColors.text,
                        qualityColors.border
                    )}>
                        {chunk.qualityScore !== null
                            ? `${(chunk.qualityScore * 100).toFixed(0)}%`
                            : 'N/A'
                        }
                    </div>
                    <span className="text-xs text-gray-400">
                        {getQualityLabel(chunk.qualityScore)}
                    </span>

                    {/* View Details button */}
                    <button
                        onClick={() => onViewDetails(chunk.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    >
                        <Eye className="w-3 h-3" />
                        Details
                    </button>
                </div>
            </div>
        </div>
    );
}
