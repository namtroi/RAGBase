import { QueryResult } from '@/api/endpoints';
import { FileText, Search, Star, Sparkles, Zap } from 'lucide-react';

interface ResultsListProps {
  results: QueryResult[];
  mode?: 'semantic' | 'hybrid';
  alpha?: number;
}

export function ResultsList({ results, mode, alpha }: ResultsListProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No results found</p>
      </div>
    );
  }

  const isHybrid = mode === 'hybrid';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Results ({results.length})
        </h3>
        {mode && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {isHybrid ? (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Hybrid ({alpha !== undefined ? `${(alpha * 100).toFixed(0)}% semantic` : ''})</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-primary-500" />
                <span>Semantic</span>
              </>
            )}
          </div>
        )}
      </div>

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
              <div className="flex items-center gap-3">
                {/* Hybrid score breakdown */}
                {isHybrid && (result.vectorScore !== undefined || result.keywordScore !== undefined) && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {result.vectorScore !== undefined && (
                      <span className="flex items-center gap-0.5" title="Vector similarity score">
                        <Sparkles className="w-3 h-3" />
                        {(result.vectorScore * 1000).toFixed(1)}
                      </span>
                    )}
                    {result.keywordScore !== undefined && (
                      <span className="flex items-center gap-0.5" title="Keyword match score">
                        <Zap className="w-3 h-3" />
                        {(result.keywordScore * 1000).toFixed(1)}
                      </span>
                    )}
                  </div>
                )}
                {/* Combined score */}
                <div className="flex items-center gap-1 text-amber-500">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="text-sm font-medium">
                    {isHybrid 
                      ? (result.score * 1000).toFixed(1) 
                      : `${(result.score * 100).toFixed(1)}%`
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            <p className="text-gray-700 text-sm line-clamp-4">
              {result.content}
            </p>

            {/* Additional metadata for hybrid mode */}
            {result.metadata.qualityScore !== undefined && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                <span>Quality: {(result.metadata.qualityScore * 100).toFixed(0)}%</span>
                {result.metadata.chunkType && (
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">{result.metadata.chunkType}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
