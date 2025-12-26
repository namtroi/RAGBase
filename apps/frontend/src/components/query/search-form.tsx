import { Select } from '@/components/ui/select';
import { useSearch } from '@/hooks/use-query';
import { Loader, Search } from 'lucide-react';
import { useState } from 'react';
import { ResultsList } from './results-list';

export function SearchForm() {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);

  const searchMutation = useSearch();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      searchMutation.mutate({ query: query.trim(), topK });
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
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
      </form>

      {/* Results */}
      {searchMutation.data && (
        <ResultsList results={searchMutation.data.results} />
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
