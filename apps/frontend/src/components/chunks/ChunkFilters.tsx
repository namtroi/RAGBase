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

    return (
        <div className="space-y-4">
            {/* Search and Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search chunks..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                </div>

                {/* Quality Filter */}
                <select
                    value={filters.quality}
                    onChange={(e) => updateFilter('quality', e.target.value as ChunkFilterState['quality'])}
                    className="text-sm border-gray-300 rounded-lg py-2 pl-3 pr-8 focus:ring-primary-500 focus:border-primary-500"
                >
                    <option value="">All Quality</option>
                    <option value="excellent">
                        Excellent (≥85%) {counts?.excellent ? `(${counts.excellent})` : ''}
                    </option>
                    <option value="good">
                        Good (70-84%) {counts?.good ? `(${counts.good})` : ''}
                    </option>
                    <option value="low">
                        Low (&lt;70%) {counts?.low ? `(${counts.low})` : ''}
                    </option>
                </select>

                {/* Type Filter */}
                <select
                    value={filters.type}
                    onChange={(e) => updateFilter('type', e.target.value as ChunkFilterState['type'])}
                    className="text-sm border-gray-300 rounded-lg py-2 pl-3 pr-8 focus:ring-primary-500 focus:border-primary-500"
                >
                    <option value="">All Types</option>
                    <option value="document">Document</option>
                    <option value="presentation">Presentation</option>
                    <option value="tabular">Tabular</option>
                </select>
            </div>
        </div>
    );
}
