import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

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

    if (total === 0) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t border-gray-100">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Rows per page:</span>
                    <select
                        value={pageSize}
                        onChange={(e) => onPageSizeChange(Number(e.target.value))}
                        className="text-sm border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white py-1 px-2"
                    >
                        {[10, 20, 50].map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                </div>
                <span className="text-sm text-gray-500">
                    Showing {startRange}-{endRange} of {total}
                </span>
            </div>

            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(1)}
                    disabled={page === 1}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent"
                    title="First Page"
                >
                    <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Previous Page"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-4 text-sm font-medium text-gray-700">
                    Page {page} of {totalPages}
                </span>

                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === totalPages}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Next Page"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onPageChange(totalPages)}
                    disabled={page === totalPages}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Last Page"
                >
                    <ChevronsRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
