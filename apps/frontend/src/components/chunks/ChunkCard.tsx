import { ChunkListItem } from '@/api/endpoints';
import clsx from 'clsx';
import { FileText, Hash, Layers, Navigation, CheckCircle, XCircle } from 'lucide-react';

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

interface ChunkCardProps {
    chunk: ChunkListItem;
}

export function ChunkCard({ chunk }: ChunkCardProps) {
    const qualityColors = getQualityColor(chunk.qualityScore);

    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-gray-900 truncate">{chunk.filename}</h3>
                            <span className="text-gray-400">›</span>
                            <span className="text-gray-500 text-sm">Chunk #{chunk.index}</span>
                        </div>
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
                            {chunk.format && (
                                <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                                    {chunk.format}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quality badge */}
                <div className="flex flex-col items-end gap-1 shrink-0">
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
                </div>
            </div>

            {/* Breadcrumbs */}
            {chunk.breadcrumbs && (
                <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                    <div className="flex items-center gap-2 text-xs text-blue-700">
                        <Navigation className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{chunk.breadcrumbs}</span>
                    </div>
                </div>
            )}

            {/* Full Content */}
            <div className="px-4 py-3">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {chunk.content}
                </p>
            </div>

            {/* Quality flags */}
            {chunk.qualityFlags && chunk.qualityFlags.length > 0 && (
                <div className="px-4 py-2 bg-amber-50 border-t border-amber-100">
                    <div className="flex flex-wrap gap-1.5">
                        {chunk.qualityFlags.map((flag) => (
                            <span
                                key={flag}
                                className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700"
                            >
                                {flag}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer: Extra metadata */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                {chunk.completeness && (
                    <span>
                        <span className="text-gray-400">Completeness:</span> {chunk.completeness}
                    </span>
                )}
                {chunk.hasTitle !== null && (
                    <span className="flex items-center gap-1">
                        <span className="text-gray-400">Title:</span>
                        {chunk.hasTitle ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : (
                            <XCircle className="w-3 h-3 text-gray-400" />
                        )}
                    </span>
                )}
                {chunk.formatCategory && (
                    <span>
                        <span className="text-gray-400">Category:</span> {chunk.formatCategory}
                    </span>
                )}
            </div>
        </div>
    );
}
