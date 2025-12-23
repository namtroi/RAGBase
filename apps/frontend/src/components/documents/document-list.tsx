import { driveApi } from '@/api/endpoints';
import { useDocuments } from '@/hooks/use-documents';
import { useQuery } from '@tanstack/react-query';
import { FileText, FolderSync, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { DocumentCard } from './document-card';

type StatusFilter = 'all' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export function DocumentList() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [folderFilter, setFolderFilter] = useState<string>('all');

  // Fetch Drive configs for filter
  const { data: configData } = useQuery({
    queryKey: ['driveConfigs'],
    queryFn: driveApi.listConfigs,
  });

  const { data, isLoading, refetch, isRefetching } = useDocuments({
    status: statusFilter === 'all' ? undefined : statusFilter,
    driveConfigId: folderFilter === 'all' ? undefined : folderFilter,
    limit: 20,
  });

  const filters: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Processing', value: 'PROCESSING' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Failed', value: 'FAILED' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {/* Filters/Actions Row */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Status Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${statusFilter === filter.value
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Drive Filter */}
        {configData?.configs && configData.configs.length > 0 && (
          <div className="flex items-center gap-2">
            <FolderSync className="w-4 h-4 text-gray-400" />
            <select
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
              className="text-sm border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white py-1.5 pl-3 pr-8"
            >
              <option value="all">All Sources</option>
              {configData.configs.map((config) => (
                <option key={config.id} value={config.id}>
                  {config.folderName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Document list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-primary-500 rounded-full" />
        </div>
      ) : data?.documents.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No documents found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.documents.map((doc) => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      )}

      {/* Total count */}
      {data && (
        <p className="text-sm text-gray-500">
          Showing {data.documents.length} of {data.total} documents
        </p>
      )}
    </div>
  );
}
