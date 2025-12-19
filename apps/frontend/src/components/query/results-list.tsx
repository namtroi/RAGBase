import { QueryResult } from '@/api/endpoints';
import { FileText, Search, Star } from 'lucide-react';

interface ResultsListProps {
  results: QueryResult[];
}

export function ResultsList({ results }: ResultsListProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No results found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">
        Results ({results.length})
      </h3>

      <div className="space-y-3">
        {results.map((result, index) => (
          <div
            key={`${result.documentId}-${index}`}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            {/* Score and metadata */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FileText className="w-4 h-4" />
                <span className="font-mono text-xs">
                  {result.documentId.slice(0, 8)}...
                </span>
                {result.metadata.page && (
                  <span>Page {result.metadata.page}</span>
                )}
                {result.metadata.heading && (
                  <span className="text-primary-600">
                    {result.metadata.heading}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="w-4 h-4 fill-current" />
                <span className="text-sm font-medium">
                  {(result.score * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Content */}
            <p className="text-gray-700 text-sm line-clamp-4">
              {result.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
