import { QueryResult } from '@/api/endpoints';
import { FileText, Search, Star, Sparkles, Zap, BookOpen, Navigation, Rocket } from 'lucide-react';

interface ResultsListProps {
  results: QueryResult[];
  mode?: 'semantic' | 'hybrid' | 'qdrant_hybrid';
  provider?: 'qdrant' | 'pgvector';
}

export function ResultsList({ results, mode, provider }: ResultsListProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No results found</p>
      </div>
    );
  }

  const isHybrid = mode === 'hybrid' || mode === 'qdrant_hybrid';
  const isQdrant = provider === 'qdrant';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Results ({results.length})
        </h3>
        <div className="flex items-center gap-3">
          {/* Qdrant Provider Badge */}
          {isQdrant && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <Rocket className="w-3 h-3" />
              Powered by Qdrant
            </span>
          )}
          {/* Search Mode Badge */}
          {mode && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {isHybrid ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Hybrid</span>
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
      </div>

      <div className="space-y-4">
        {results.map((result, index) => (
          <div
            key={`${result.documentId}-${index}`}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Header: Document ID, Page, Scores */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="font-mono text-xs">
                    {result.documentId.slice(0, 8)}...
                  </span>
                </div>
                {result.metadata.page && (
                  <span className="text-gray-500">Page {result.metadata.page}</span>
                )}
              </div>

              {/* Scores */}
              <div className="flex items-center gap-3">
                {isHybrid && (result.vectorScore !== undefined || result.keywordScore !== undefined) && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {result.vectorScore !== undefined && (
                      <span className="flex items-center gap-0.5" title="Vector similarity score">
                        <Sparkles className="w-3 h-3" />
                        {(result.vectorScore * 100).toFixed(1)}
                      </span>
                    )}
                    {result.keywordScore !== undefined && (
                      <span className="flex items-center gap-0.5" title="Keyword match score">
                        <Zap className="w-3 h-3" />
                        {(result.keywordScore * 100).toFixed(1)}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1 text-amber-500">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="text-sm font-medium">
                    {(result.score * 100).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Breadcrumbs */}
            {result.metadata.breadcrumbs && result.metadata.breadcrumbs.length > 0 && (
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                <div className="flex items-center gap-2 text-xs text-blue-700">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{result.metadata.breadcrumbs.join(' › ')}</span>
                </div>
              </div>
            )}

            {/* Heading */}
            {result.metadata.heading && (
              <div className="px-4 py-2 bg-primary-50 border-b border-primary-100">
                <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
                  <BookOpen className="w-4 h-4" />
                  <span>{result.metadata.heading}</span>
                </div>
              </div>
            )}

            {/* Full Content */}
            <div className="px-4 py-3">
              <p className="text-gray-700 text-sm whitespace-pre-wrap">
                {result.content}
              </p>
            </div>

            {/* Footer: Quality & Type */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center gap-3 text-xs text-gray-500">
              {result.metadata.qualityScore !== undefined && (
                <span className="flex items-center gap-1">
                  <span className="text-gray-400">Quality:</span>
                  <span className="font-medium">{(result.metadata.qualityScore * 100).toFixed(0)}%</span>
                </span>
              )}
              {result.metadata.chunkType && (
                <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                  {result.metadata.chunkType}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
