import { Select } from '@/components/ui/select';
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

    // Options definitions
    const sortOptions = [
        { label: 'Date', value: 'createdAt' },
        { label: 'Name', value: 'filename' },
        { label: 'Size', value: 'fileSize' },
    ];

    const statusOptions = [
        { label: 'All Statuses', value: '' },
        { label: 'Pending', value: 'PENDING', count: counts?.pending },
        { label: 'Processing', value: 'PROCESSING', count: counts?.processing },
        { label: 'Completed', value: 'COMPLETED', count: counts?.completed },
        { label: 'Failed', value: 'FAILED', count: counts?.failed },
    ];

    const availabilityOptions = [
        { label: 'All Availability', value: '' },
        { label: 'Active', value: 'true', count: counts?.active },
        { label: 'Inactive', value: 'false', count: counts?.inactive },
    ];

    const connectionOptions = [
        { label: 'All Connections', value: '' },
        { label: 'Standalone', value: 'STANDALONE' },
        { label: 'Linked', value: 'LINKED' },
    ];

    const sourceOptions = [
        { label: 'All Sources', value: '' },
        { label: 'Manual Upload', value: 'MANUAL' },
        { label: 'Google Drive', value: 'DRIVE' },
    ];

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
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 hover:border-gray-400 transition-colors"
                    />
                </div>

                {/* Sort */}
                <div className="flex items-center gap-2">
                    <Select
                        value={filters.sortBy}
                        onChange={(val) => updateFilter('sortBy', val as FilterState['sortBy'])}
                        options={sortOptions}
                        className="w-[120px]"
                    />
                    <button
                        onClick={toggleSort}
                        className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
                <Select
                    value={filters.status}
                    onChange={(val) => updateFilter('status', val as string)}
                    options={statusOptions}
                    placeholder="Status"
                    className="w-[160px]"
                />

                {/* Availability Filter */}
                <Select
                    value={filters.isActive}
                    onChange={(val) => updateFilter('isActive', val as string)}
                    options={availabilityOptions}
                    placeholder="Availability"
                    className="w-[160px]"
                />

                {/* Connection State Filter */}
                <Select
                    value={filters.connectionState}
                    onChange={(val) => updateFilter('connectionState', val as string)}
                    options={connectionOptions}
                    placeholder="Connection"
                    className="w-[160px]"
                />

                {/* Source Type Filter */}
                <Select
                    value={filters.sourceType}
                    onChange={(val) => updateFilter('sourceType', val as string)}
                    options={sourceOptions}
                    placeholder="Source"
                    className="w-[160px]"
                />
            </div>
        </div>
    );
}
