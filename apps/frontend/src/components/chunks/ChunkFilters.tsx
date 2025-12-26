import { Select } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface ChunkFilterState {
    search: string;
    quality: '' | 'excellent' | 'good' | 'low';
    type: '' | 'document' | 'presentation' | 'tabular';
}

interface ChunkFiltersProps {
    filters: ChunkFilterState;
    onChange: (filters: ChunkFilterState) => void;
    counts?: {
        excellent: number;
        good: number;
        low: number;
    };
}

export function ChunkFilters({ filters, onChange, counts }: ChunkFiltersProps) {
    const [searchInput, setSearchInput] = useState(filters.search);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput !== filters.search) {
                onChange({ ...filters, search: searchInput });
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput, filters, onChange]);

    const updateFilter = <K extends keyof ChunkFilterState>(key: K, value: ChunkFilterState[K]) => {
        onChange({ ...filters, [key]: value });
    };

    const qualityOptions = [
        { label: 'All Quality', value: '' },
        { label: 'Excellent (≥85%)', value: 'excellent', count: counts?.excellent },
        { label: 'Good (70-84%)', value: 'good', count: counts?.good },
        { label: 'Low (<70%)', value: 'low', count: counts?.low },
    ];

    const typeOptions = [
        { label: 'All Types', value: '' },
        { label: 'Document', value: 'document' },
        { label: 'Presentation', value: 'presentation' },
        { label: 'Tabular', value: 'tabular' },
    ];

    return (
        <div className="space-y-4">
            {/* Search and Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Filter by text..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 hover:border-gray-400 transition-colors"
                    />
                </div>

                {/* Quality Filter */}
                <Select
                    value={filters.quality}
                    onChange={(val) => updateFilter('quality', val as ChunkFilterState['quality'])}
                    options={qualityOptions}
                    placeholder="Quality"
                    className="w-[180px]"
                />

                {/* Type Filter */}
                <Select
                    value={filters.type}
                    onChange={(val) => updateFilter('type', val as ChunkFilterState['type'])}
                    options={typeOptions}
                    placeholder="Type"
                    className="w-[140px]"
                />
            </div>
        </div>
    );
}
