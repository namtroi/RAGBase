import { useAnalyticsOverview, useAnalyticsProcessing, useAnalyticsQuality } from '@/hooks/use-analytics';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, BarChart3, ChevronDown, Clock, FileText, Layers, Zap } from 'lucide-react';

const formatOptions = [
    { label: 'PDF', value: 'pdf' },
    { label: 'DOCX', value: 'docx' },
    { label: 'PPTX', value: 'pptx' },
    { label: 'EPUB', value: 'epub' },
    { label: 'MD', value: 'md' },
    { label: 'TXT', value: 'txt' },
    { label: 'HTML', value: 'html' },
    { label: 'XLSX', value: 'xlsx' },
    { label: 'CSV', value: 'csv' },
    { label: 'JSON', value: 'json' },
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

function formatPercent(n: number): string {
    return `${n.toFixed(1)}%`;
}

// Overview stat card (no filter applied)
function OverviewCard({ title, value, subtitle, color }: {
    title: string;
    value: string;
    subtitle?: string;
    color: string
}) {
    const borderColors: Record<string, string> = {
        blue: 'border-t-blue-500',
        emerald: 'border-t-emerald-500',
        amber: 'border-t-amber-500',
        violet: 'border-t-violet-500',
        cyan: 'border-t-cyan-500',
        teal: 'border-t-teal-500',
    };

    return (
        <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 border-t-4 ${borderColors[color]}`}>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
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
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-gray-50">
                        {icon}
                    </div>
                    <div>
                        <span className="text-xs font-medium text-gray-400">{stageNum}</span>
                        <h4 className="font-semibold text-gray-800">{title}</h4>
                    </div>
                </div>

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

                {footer && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                        {footer}
                    </div>
                )}
            </div>

            {showArrow && (
                <div className="flex justify-center py-3">
                    <ArrowDown className="w-5 h-5 text-gray-300" />
                </div>
            )}
        </div>
    );
}

export function AnalyticsPage() {
    const [format, setFormat] = useState('pdf'); // Default to PDF
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        }

        if (dropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [dropdownOpen]);

    // Overview data (no filters)
    const { data: overview, isLoading: loadingOverview } = useAnalyticsOverview();
    // Pipeline data (with format filter)
    const { data: processing, isLoading: loadingProcessing } = useAnalyticsProcessing(format);
    const { data: quality, isLoading: loadingQuality } = useAnalyticsQuality();

    const isLoading = loadingOverview || loadingProcessing || loadingQuality;

    // Get top format from distribution
    const topFormat = overview?.formatDistribution
        ? Object.entries(overview.formatDistribution)
            .sort(([, a], [, b]) => b - a)[0]
        : null;
    const topFormatLabel = topFormat
        ? `${topFormat[0].toUpperCase()} ${((topFormat[1] / (overview?.totalDocuments || 1)) * 100).toFixed(0)}%`
        : 'N/A';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-gray-400" />
                    Analytics
                </h2>
                <p className="text-sm text-gray-500">Monitor your RAG pipeline performance</p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
            ) : (
                <>
                    {/* Overview Section (All Time, All Formats) */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-6">Overview (All Time, All Formats)</h3>

                        {/* Row 1: Counts */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <OverviewCard
                                title="Total Documents"
                                value={formatNumber(overview?.totalDocuments || 0)}
                                color="blue"
                            />
                            <OverviewCard
                                title="Total Chunks"
                                value={formatNumber(overview?.totalChunks || 0)}
                                color="violet"
                            />
                            <OverviewCard
                                title="Success Rate"
                                value={formatPercent(overview?.successRate || 0)}
                                color="emerald"
                            />
                            <OverviewCard
                                title="Top Format"
                                value={topFormatLabel}
                                color="amber"
                            />
                        </div>

                        {/* Row 2: Times */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <OverviewCard
                                title="Avg Processing Time / File"
                                value={formatMs(overview?.avgProcessingTimeMs || 0)}
                                color="cyan"
                            />
                            <OverviewCard
                                title="Avg User Wait Time / File"
                                value={formatMs(overview?.avgUserWaitTimeMs || 0)}
                                subtitle="(Queue + Processing)"
                                color="teal"
                            />
                        </div>
                    </div>

                    {/* Pipeline Section (with filters) */}
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-gray-800">Pipeline Stages</h3>

                            {/* Format Dropdown */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                                >
                                    {formatOptions.find(f => f.value === format)?.label || 'PDF'}
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                </button>
                                {dropdownOpen && (
                                    <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                        {formatOptions.map((f) => (
                                            <button
                                                key={f.value}
                                                onClick={() => {
                                                    setFormat(f.value);
                                                    setDropdownOpen(false);
                                                }}
                                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${format === f.value ? 'text-blue-600 font-medium' : 'text-gray-700'
                                                    }`}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Stage 1: Queue */}
                        <StageCard
                            stageNum="STAGE 1"
                            title="Upload / Queue"
                            icon={<FileText className="w-5 h-5 text-blue-500" />}
                            stats={[
                                { label: 'Files Uploaded', value: formatNumber(processing?.documentsProcessed || 0) },
                                { label: 'Avg Queue Time / File', value: formatMs(processing?.breakdown.avgQueueTimeMs || 0) },
                            ]}
                        />

                        {/* Stage 2: Conversion */}
                        <StageCard
                            stageNum="STAGE 2"
                            title="Conversion (Raw → Markdown)"
                            icon={<Zap className="w-5 h-5 text-amber-500" />}
                            stats={[
                                { label: 'Avg Conversion Time / File', value: formatMs(processing?.breakdown.avgConversionTimeMs || 0) },
                                { label: 'Avg Time / Page', value: formatMs(processing?.avgConversionTimePerPage || 0) },
                                { label: 'OCR Usage %', value: `${processing?.ocrUsagePercent || 0}%` },
                                { label: 'Processed Files', value: formatNumber(processing?.documentsProcessed || 0) },
                            ]}
                        />

                        {/* Stage 3: Chunking & Quality (Merged) */}
                        <StageCard
                            stageNum="STAGE 3"
                            title="Chunking & Quality"
                            icon={<Layers className="w-5 h-5 text-indigo-500" />}
                            stats={[
                                { label: 'Total Chunks', value: formatNumber(quality?.totalChunks || 0) },
                                { label: 'Avg Tokens / Chunk', value: formatNumber(quality?.avgTokensPerChunk || 0) },
                                { label: 'Avg Chunking Time / File', value: formatMs(processing?.breakdown.avgChunkingTimeMs || 0) },
                                { label: 'Avg Quality Score', value: `${((quality?.avgQualityScore || 0) * 100).toFixed(0)}%` },
                            ]}
                            footer={
                                <div className="space-y-2">
                                    {/* Quality Distribution */}
                                    <div className="flex gap-4 text-sm">
                                        <span className="text-emerald-600">Excellent: {quality?.distribution.excellent || 0}</span>
                                        <span className="text-blue-600">Good: {quality?.distribution.good || 0}</span>
                                        <span className="text-amber-600">Low: {quality?.distribution.low || 0}</span>
                                    </div>
                                    {/* Rate Badges */}
                                    <div className="flex gap-2 flex-wrap">
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                                            Fragment: {quality?.fragmentRate || 0}%
                                        </span>
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">
                                            No Context: {quality?.noContextRate || 0}%
                                        </span>
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">
                                            Too Short: {quality?.tooShortRate || 0}%
                                        </span>
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                                            Context Injected: {quality?.contextInjectionRate || 0}%
                                        </span>
                                    </div>
                                </div>
                            }
                        />

                        {/* Stage 4: Embedding */}
                        <StageCard
                            stageNum="STAGE 4"
                            title="Embedding"
                            icon={<Clock className="w-5 h-5 text-violet-500" />}
                            stats={[
                                { label: 'Vectors Indexed', value: formatNumber(quality?.totalChunks || 0) },
                                { label: 'Avg Embedding Time / File', value: formatMs(processing?.breakdown.avgEmbeddingTimeMs || 0) },
                            ]}
                            showArrow={false}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
