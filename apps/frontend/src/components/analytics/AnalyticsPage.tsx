import { useAnalyticsOverview, useAnalyticsProcessing, useAnalyticsQuality, Period } from '@/hooks/use-analytics';
import { useState } from 'react';
import { ArrowDown, BarChart3, Clock, FileText, Layers, Sparkles, Zap } from 'lucide-react';

const periods: { label: string; value: Period }[] = [
    { label: '24h', value: '24h' },
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
];

function formatMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function formatNumber(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
}

// Summary stat card with colored top border
function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
    const borderColors: Record<string, string> = {
        blue: 'border-t-blue-500',
        emerald: 'border-t-emerald-500',
        amber: 'border-t-amber-500',
        violet: 'border-t-violet-500',
    };

    return (
        <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 border-t-4 ${borderColors[color]}`}>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
    );
}

// Pipeline stage card
interface StageCardProps {
    stageNum: string;
    title: string;
    icon: React.ReactNode;
    stats: Array<{ label: string; value: string | number; color?: string }>;
    footer?: React.ReactNode;
    showArrow?: boolean;
}

function StageCard({ stageNum, title, icon, stats, footer, showArrow = true }: StageCardProps) {
    return (
        <div className="relative">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                {/* Header with icon and title on LEFT */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-gray-50">
                        {icon}
                    </div>
                    <div>
                        <span className="text-xs font-medium text-gray-400">{stageNum}</span>
                        <h4 className="font-semibold text-gray-800">{title}</h4>
                    </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-4">
                    {stats.map((stat, i) => (
                        <div key={i}>
                            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                            <p className={`text-lg font-semibold ${stat.color || 'text-gray-900'}`}>
                                {stat.value}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Footer for badges */}
                {footer && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                        {footer}
                    </div>
                )}
            </div>

            {/* Arrow connector */}
            {showArrow && (
                <div className="flex justify-center py-3">
                    <ArrowDown className="w-5 h-5 text-gray-300" />
                </div>
            )}
        </div>
    );
}

export function AnalyticsPage() {
    const [periodIndex, setPeriodIndex] = useState(1); // Default to 7d
    const period = periods[periodIndex].value;

    const { data: overview, isLoading: loadingOverview } = useAnalyticsOverview(period);
    const { data: processing, isLoading: loadingProcessing } = useAnalyticsProcessing(period);
    const { data: quality, isLoading: loadingQuality } = useAnalyticsQuality(period);

    const isLoading = loadingOverview || loadingProcessing || loadingQuality;

    return (
        <div className="space-y-6">
            {/* Header + Actions */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-gray-400" />
                        Analytics
                    </h2>
                    <p className="text-sm text-gray-500">Monitor your RAG pipeline performance</p>
                </div>

                {/* Period Selector */}
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                    {periods.map((p, idx) => (
                        <button
                            key={p.value}
                            onClick={() => setPeriodIndex(idx)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${periodIndex === idx
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
            ) : (
                <>
                    {/* Summary Cards - 4 column grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title="Total Documents"
                            value={formatNumber(overview?.totalDocuments || 0)}
                            color="blue"
                        />
                        <StatCard
                            title="Avg Processing Time"
                            value={formatMs(overview?.avgProcessingTimeMs || 0)}
                            color="emerald"
                        />
                        <StatCard
                            title="Avg Quality Score"
                            value={`${((overview?.avgQualityScore || 0) * 100).toFixed(0)}%`}
                            color="amber"
                        />
                        <StatCard
                            title="Total Chunks"
                            value={formatNumber(overview?.totalChunks || 0)}
                            color="violet"
                        />
                    </div>

                    {/* Pipeline Funnel */}
                    <div className="bg-gray-50 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-6">Pipeline Stages</h3>

                        {/* Stage 1: Queue */}
                        <StageCard
                            stageNum="STAGE 1"
                            title="Upload / Queue"
                            icon={<FileText className="w-5 h-5 text-blue-500" />}
                            stats={[
                                { label: 'Files Uploaded', value: formatNumber(overview?.totalDocuments || 0) },
                                { label: 'Avg Queue Time', value: formatMs(processing?.breakdown.avgQueueTimeMs || 0) },
                            ]}
                        />

                        {/* Stage 2: Conversion */}
                        <StageCard
                            stageNum="STAGE 2"
                            title="Conversion (Raw → Markdown)"
                            icon={<Zap className="w-5 h-5 text-amber-500" />}
                            stats={[
                                { label: 'Avg Time', value: formatMs(processing?.breakdown.avgConversionTimeMs || 0) },
                                { label: 'Processed', value: formatNumber(processing?.documentsProcessed || 0) },
                            ]}
                        />

                        {/* Stage 3: Chunking */}
                        <StageCard
                            stageNum="STAGE 3"
                            title="Chunking (Markdown → Chunks)"
                            icon={<Layers className="w-5 h-5 text-indigo-500" />}
                            stats={[
                                { label: 'Total Chunks', value: formatNumber(overview?.totalChunks || 0) },
                                { label: 'Avg Time', value: formatMs(processing?.breakdown.avgChunkingTimeMs || 0) },
                            ]}
                        />

                        {/* Stage 4: Quality */}
                        <StageCard
                            stageNum="STAGE 4"
                            title="Quality Analysis"
                            icon={<Sparkles className="w-5 h-5 text-emerald-500" />}
                            stats={[
                                { label: 'Avg Score', value: `${((quality?.avgQualityScore || 0) * 100).toFixed(0)}%` },
                                { label: 'Excellent', value: formatNumber(quality?.distribution.excellent || 0), color: 'text-emerald-600' },
                                { label: 'Good', value: formatNumber(quality?.distribution.good || 0), color: 'text-blue-600' },
                                { label: 'Low', value: formatNumber(quality?.distribution.low || 0), color: 'text-amber-600' },
                            ]}
                            footer={
                                quality?.flags && Object.keys(quality.flags).length > 0 && (
                                    <div className="flex gap-2 flex-wrap">
                                        {Object.entries(quality.flags).slice(0, 4).map(([flag, count]) => (
                                            <span
                                                key={flag}
                                                className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700"
                                            >
                                                {flag}: {count}
                                            </span>
                                        ))}
                                    </div>
                                )
                            }
                        />

                        {/* Stage 5: Embedding */}
                        <StageCard
                            stageNum="STAGE 5"
                            title="Embedding"
                            icon={<Clock className="w-5 h-5 text-violet-500" />}
                            stats={[
                                { label: 'Avg Time', value: formatMs(processing?.breakdown.avgEmbeddingTimeMs || 0) },
                                { label: 'Vectors Indexed', value: formatNumber(overview?.totalChunks || 0) },
                            ]}
                            showArrow={false}
                        />
                    </div>

                    {/* Total Pipeline Time - Custom styled */}
                    <div className="bg-liner-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Pipeline Time</p>
                                <p className="text-3xl font-bold text-indigo-600">
                                    {formatMs(processing?.breakdown.avgTotalTimeMs || 0)}
                                </p>
                            </div>
                            <div className="sm:text-right">
                                <p className="text-sm text-gray-500">User Wait Time (Queue + Processing)</p>
                                <p className="text-2xl font-bold text-gray-800">
                                    {formatMs(processing?.breakdown.avgUserWaitTimeMs || 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
