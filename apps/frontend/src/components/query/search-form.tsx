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
        <div>
          <label
            htmlFor="query"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Search Query
          </label>
          <div className="relative">
            <input
              id="query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your search query..."
              className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              maxLength={1000}
            />
            <button
              type="submit"
              disabled={!query.trim() || searchMutation.isPending}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-primary-500 disabled:opacity-50"
            >
              {searchMutation.isPending ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600">Results:</label>
          <select
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            {[3, 5, 10, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
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
