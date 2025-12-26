import { Select } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useState } from 'react';

interface PaginationProps {
    total: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
}

export function Pagination({
    total,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
}: PaginationProps) {
    const totalPages = Math.ceil(total / pageSize);
    const startRange = (page - 1) * pageSize + 1;
    const endRange = Math.min(page * pageSize, total);
    const [jumpInput, setJumpInput] = useState('');

    if (total === 0) return null;

    const handleJumpToPage = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const targetPage = parseInt(jumpInput, 10);
            if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
                onPageChange(targetPage);
                setJumpInput('');
            }
        }
    };

    const pageSizeOptions = [10, 20, 50].map(size => ({
        label: String(size),
        value: size
    }));

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t border-gray-100">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Rows per page:</span>
                    <Select
                        value={pageSize}
                        onChange={(val: string | number) => onPageSizeChange(Number(val))}
                        options={pageSizeOptions}
                        className="w-[70px] min-w-[70px]"
                    />
                </div>
                <span className="text-sm text-gray-500">
                    Showing {startRange}-{endRange} of {total}
                </span>
            </div>

            <div className="flex items-center gap-2">
                {/* Navigation Buttons */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onPageChange(1)}
                        disabled={page === 1}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        title="First Page"
                    >
                        <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onPageChange(page - 1)}
                        disabled={page === 1}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        title="Previous Page"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                </div>

                {/* Page Info + Jump Input */}
                <div className="flex items-center gap-2 px-2">
                    <span className="text-sm text-gray-600">Page</span>
                    <input
                        type="text"
                        value={jumpInput}
                        onChange={(e) => setJumpInput(e.target.value)}
                        onKeyDown={handleJumpToPage}
                        placeholder={String(page)}
                        className="w-12 text-center text-sm border border-gray-300 rounded-md py-1 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 hover:border-gray-400 transition-colors"
                        title="Type page number and press Enter"
                    />
                    <span className="text-sm text-gray-600">of {totalPages}</span>
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onPageChange(page + 1)}
                        disabled={page === totalPages}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        title="Next Page"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onPageChange(totalPages)}
                        disabled={page === totalPages}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        title="Last Page"
                    >
                        <ChevronsRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
