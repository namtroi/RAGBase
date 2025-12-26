import { Select } from '@/components/ui/select';
import { useSearch } from '@/hooks/use-query';
import clsx from 'clsx';
import { Loader, Search, Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';
import { ResultsList } from './results-list';

type SearchMode = 'semantic' | 'hybrid';

export function SearchForm() {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [mode, setMode] = useState<SearchMode>('semantic');
  const [alpha, setAlpha] = useState(0.7);

  const searchMutation = useSearch();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      searchMutation.mutate({ 
        query: query.trim(), 
        topK,
        mode,
        alpha: mode === 'hybrid' ? alpha : undefined,
      });
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Search Input Row */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your search query..."
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 hover:border-gray-400 transition-colors"
              maxLength={1000}
            />
            {searchMutation.isPending && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader className="w-4 h-4 animate-spin text-primary-500" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-gray-600">Results:</span>
            <Select
              value={topK}
              onChange={(val: string | number) => setTopK(Number(val))}
              options={[3, 5, 10, 20].map((n) => ({ label: String(n), value: n }))}
              className="w-[70px] min-w-[70px]"
            />
          </div>
        </div>

        {/* Search Mode Row */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Mode:</span>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setMode('semantic')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors',
                  mode === 'semantic'
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Semantic
              </button>
              <button
                type="button"
                onClick={() => setMode('hybrid')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors border-l border-gray-300',
                  mode === 'hybrid'
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                Hybrid
              </button>
            </div>
          </div>

          {/* Alpha Slider - only shown in hybrid mode */}
          {mode === 'hybrid' && (
            <div className="flex items-center gap-3 animate-in slide-in-from-left-2 duration-200">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Balance:</span>
                <span className="text-xs text-gray-400 font-mono">Keyword</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={alpha}
                  onChange={(e) => setAlpha(parseFloat(e.target.value))}
                  className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
                <span className="text-xs text-gray-400 font-mono">Vector</span>
              </div>
              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                {(alpha * 100).toFixed(0)}% semantic
              </span>
            </div>
          )}
        </div>
      </form>

      {/* Results */}
      {searchMutation.data && (
        <ResultsList 
          results={searchMutation.data.results} 
          mode={searchMutation.data.mode}
          alpha={searchMutation.data.alpha}
        />
      )}

      {/* Error */}
      {searchMutation.isError && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          <p className="font-medium">Search failed</p>
          <p className="text-sm">
            {(searchMutation.error as Error).message}
          </p>
        </div>
      )}
    </div>
  );
}
