import { Card, Metric, Text, Flex, TabGroup, TabList, Tab, Badge, Grid } from '@tremor/react';
import { useAnalyticsOverview, useAnalyticsProcessing, useAnalyticsQuality, Period } from '@/hooks/use-analytics';
import { useState } from 'react';
import { ArrowDown, Clock, FileText, Layers, Sparkles, Zap } from 'lucide-react';

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

interface StageCardProps {
    title: string;
    icon: React.ReactNode;
    stats: Array<{ label: string; value: string | number; color?: string }>;
    footer?: React.ReactNode;
    showArrow?: boolean;
}

function StageCard({ title, icon, stats, footer, showArrow = true }: StageCardProps) {
    return (
        <div className="relative">
            <Card className="p-4">
                <Flex className="items-center gap-2 mb-3">
                    {icon}
                    <Text className="font-semibold text-gray-700">{title}</Text>
                </Flex>
                <div className="grid grid-cols-2 gap-4">
                    {stats.map((stat, i) => (
                        <div key={i}>
                            <Text className="text-xs text-gray-500">{stat.label}</Text>
                            <Text className={`font-semibold ${stat.color || 'text-gray-900'}`}>{stat.value}</Text>
                        </div>
                    ))}
                </div>
                {footer && <div className="mt-3 pt-3 border-t border-gray-100">{footer}</div>}
            </Card>
            {showArrow && (
                <div className="flex justify-center py-2">
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
            {/* Header */}
            <Flex className="justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">📊 Pipeline Analytics</h2>
                    <Text className="text-gray-500">Monitor your RAG pipeline performance</Text>
                </div>
                <TabGroup index={periodIndex} onIndexChange={setPeriodIndex}>
                    <TabList variant="solid">
                        {periods.map((p) => (
                            <Tab key={p.value}>{p.label}</Tab>
                        ))}
                    </TabList>
                </TabGroup>
            </Flex>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-4">
                        <Card decoration="top" decorationColor="blue">
                            <Text>Total Documents</Text>
                            <Metric>{formatNumber(overview?.totalDocuments || 0)}</Metric>
                        </Card>
                        <Card decoration="top" decorationColor="emerald">
                            <Text>Avg Processing Time</Text>
                            <Metric>{formatMs(overview?.avgProcessingTimeMs || 0)}</Metric>
                        </Card>
                        <Card decoration="top" decorationColor="amber">
                            <Text>Avg Quality Score</Text>
                            <Metric>{((overview?.avgQualityScore || 0) * 100).toFixed(0)}%</Metric>
                        </Card>
                        <Card decoration="top" decorationColor="violet">
                            <Text>Total Chunks</Text>
                            <Metric>{formatNumber(overview?.totalChunks || 0)}</Metric>
                        </Card>
                    </Grid>

                    {/* Pipeline Funnel */}
                    <div className="bg-gray-50 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Pipeline Stages</h3>

                        {/* Stage 1: Queue */}
                        <StageCard
                            title="① Upload / Queue"
                            icon={<FileText className="w-5 h-5 text-blue-500" />}
                            stats={[
                                { label: 'Files Uploaded', value: formatNumber(overview?.totalDocuments || 0) },
                                { label: 'Avg Queue Time', value: formatMs(processing?.breakdown.avgQueueTimeMs || 0) },
                            ]}
                        />

                        {/* Stage 2: Conversion */}
                        <StageCard
                            title="② Conversion (Raw → Markdown)"
                            icon={<Zap className="w-5 h-5 text-amber-500" />}
                            stats={[
                                { label: 'Avg Time', value: formatMs(processing?.breakdown.avgConversionTimeMs || 0) },
                                { label: 'Processed', value: formatNumber(processing?.documentsProcessed || 0) },
                            ]}
                        />

                        {/* Stage 3: Chunking */}
                        <StageCard
                            title="③ Chunking (Markdown → Chunks)"
                            icon={<Layers className="w-5 h-5 text-indigo-500" />}
                            stats={[
                                { label: 'Total Chunks', value: formatNumber(overview?.totalChunks || 0) },
                                { label: 'Avg Time', value: formatMs(processing?.breakdown.avgChunkingTimeMs || 0) },
                            ]}
                        />

                        {/* Stage 4: Quality */}
                        <StageCard
                            title="④ Quality Analysis"
                            icon={<Sparkles className="w-5 h-5 text-emerald-500" />}
                            stats={[
                                { label: 'Avg Score', value: `${((quality?.avgQualityScore || 0) * 100).toFixed(0)}%` },
                                { label: 'Excellent', value: formatNumber(quality?.distribution.excellent || 0), color: 'text-emerald-600' },
                                { label: 'Good', value: formatNumber(quality?.distribution.good || 0), color: 'text-blue-600' },
                                { label: 'Low', value: formatNumber(quality?.distribution.low || 0), color: 'text-amber-600' },
                            ]}
                            footer={
                                quality?.flags && Object.keys(quality.flags).length > 0 && (
                                    <Flex className="gap-2 flex-wrap">
                                        {Object.entries(quality.flags).slice(0, 3).map(([flag, count]) => (
                                            <Badge key={flag} color="amber" size="xs">
                                                {flag}: {count}
                                            </Badge>
                                        ))}
                                    </Flex>
                                )
                            }
                        />

                        {/* Stage 5: Embedding */}
                        <StageCard
                            title="⑤ Embedding"
                            icon={<Clock className="w-5 h-5 text-violet-500" />}
                            stats={[
                                { label: 'Avg Time', value: formatMs(processing?.breakdown.avgEmbeddingTimeMs || 0) },
                                { label: 'Vectors Indexed', value: formatNumber(overview?.totalChunks || 0) },
                            ]}
                            showArrow={false}
                        />
                    </div>

                    {/* Total Pipeline Time */}
                    <Card className="bg-linear-to-r from-blue-50 to-indigo-50">
                        <Flex className="items-center justify-between">
                            <div>
                                <Text className="font-semibold text-gray-700">Total Pipeline Time</Text>
                                <Metric className="text-indigo-600">
                                    {formatMs(processing?.breakdown.avgTotalTimeMs || 0)}
                                </Metric>
                            </div>
                            <div className="text-right">
                                <Text className="text-gray-500">User Wait Time (Queue + Processing)</Text>
                                <Text className="text-2xl font-bold text-gray-800">
                                    {formatMs(processing?.breakdown.avgUserWaitTimeMs || 0)}
                                </Text>
                            </div>
                        </Flex>
                    </Card>
                </>
            )}
        </div>
    );
}
