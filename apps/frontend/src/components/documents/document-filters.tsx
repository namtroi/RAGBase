import { Search, SortAsc, SortDesc } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface FilterState {
    search: string;
    status: string;
    isActive: string;
    connectionState: string;
    sourceType: string;
    sortBy: 'createdAt' | 'filename' | 'fileSize';
    sortOrder: 'asc' | 'desc';
}

interface DocumentFiltersProps {
    filters: FilterState;
    onChange: (filters: FilterState) => void;
    counts?: {
        active: number;
        inactive: number;
        failed: number;
        pending: number;
        processing: number;
        completed: number;
    };
}

export function DocumentFilters({ filters, onChange, counts }: DocumentFiltersProps) {
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

    const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
        onChange({ ...filters, [key]: value });
    };

    const toggleSort = () => {
        updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc');
    };

    return (
        <div className="space-y-4">
            {/* Search and Sort Row */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search documents..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                </div>

                {/* Sort */}
                <div className="flex items-center gap-2">
                    <select
                        value={filters.sortBy}
                        onChange={(e) => updateFilter('sortBy', e.target.value as FilterState['sortBy'])}
                        className="text-sm border-gray-300 rounded-lg py-2 pl-3 pr-8 focus:ring-primary-500 focus:border-primary-500"
                    >
                        <option value="createdAt">Date</option>
                        <option value="filename">Name</option>
                        <option value="fileSize">Size</option>
                    </select>
                    <button
                        onClick={toggleSort}
                        className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        title={filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                    >
                        {filters.sortOrder === 'asc' ? (
                            <SortAsc className="w-4 h-4 text-gray-600" />
                        ) : (
                            <SortDesc className="w-4 h-4 text-gray-600" />
                        )}
                    </button>
                </div>
            </div>

            {/* Filter Dropdowns Row */}
            <div className="flex flex-wrap gap-3">
                {/* Status Filter */}
                <select
                    value={filters.status}
                    onChange={(e) => updateFilter('status', e.target.value)}
                    className="text-sm border-gray-300 rounded-lg py-2 pl-3 pr-8 focus:ring-primary-500 focus:border-primary-500"
                >
                    <option value="">All Statuses</option>
                    <option value="PENDING">Pending {counts?.pending ? `(${counts.pending})` : ''}</option>
                    <option value="PROCESSING">Processing {counts?.processing ? `(${counts.processing})` : ''}</option>
                    <option value="COMPLETED">Completed {counts?.completed ? `(${counts.completed})` : ''}</option>
                    <option value="FAILED">Failed {counts?.failed ? `(${counts.failed})` : ''}</option>
                </select>

                {/* Availability Filter */}
                <select
                    value={filters.isActive}
                    onChange={(e) => updateFilter('isActive', e.target.value)}
                    className="text-sm border-gray-300 rounded-lg py-2 pl-3 pr-8 focus:ring-primary-500 focus:border-primary-500"
                >
                    <option value="">All Availability</option>
                    <option value="true">Active {counts?.active ? `(${counts.active})` : ''}</option>
                    <option value="false">Inactive {counts?.inactive ? `(${counts.inactive})` : ''}</option>
                </select>

                {/* Connection State Filter */}
                <select
                    value={filters.connectionState}
                    onChange={(e) => updateFilter('connectionState', e.target.value)}
                    className="text-sm border-gray-300 rounded-lg py-2 pl-3 pr-8 focus:ring-primary-500 focus:border-primary-500"
                >
                    <option value="">All Connections</option>
                    <option value="STANDALONE">Standalone</option>
                    <option value="LINKED">Linked</option>
                </select>

                {/* Source Type Filter */}
                <select
                    value={filters.sourceType}
                    onChange={(e) => updateFilter('sourceType', e.target.value)}
                    className="text-sm border-gray-300 rounded-lg py-2 pl-3 pr-8 focus:ring-primary-500 focus:border-primary-500"
                >
                    <option value="">All Sources</option>
                    <option value="MANUAL">Manual Upload</option>
                    <option value="DRIVE">Google Drive</option>
                </select>
            </div>
        </div>
    );
}
