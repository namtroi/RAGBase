import { driveApi } from '@/api/endpoints';
import { useDocuments } from '@/hooks/use-documents';
import { useSelection } from '@/hooks/use-selection';
import { useQuery } from '@tanstack/react-query';
import { FileText, FolderSync } from 'lucide-react';
import { useState } from 'react';
import { Select } from '@/components/ui/select';
import { BulkActionBar } from './bulk-action-bar';
import { DeleteConfirmModal } from './delete-confirm-modal';
import { DocumentCard } from './document-card';
import { DocumentFilters, FilterState } from './document-filters';
import { Pagination } from './pagination';

const defaultFilters: FilterState = {
  search: '',
  status: '',
  isActive: '',
  connectionState: '',
  sourceType: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export function DocumentList() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const selection = useSelection();

  // Fetch Drive configs for filter
  const { data: configData } = useQuery({
    queryKey: ['driveConfigs'],
    queryFn: driveApi.listConfigs,
  });

  // Build query params from filters
  const queryParams = {
    status: filters.status || undefined,
    isActive: filters.isActive ? filters.isActive === 'true' : undefined,
    connectionState: filters.connectionState as 'STANDALONE' | 'LINKED' | undefined || undefined,
    sourceType: filters.sourceType as 'MANUAL' | 'DRIVE' | undefined || undefined,
    search: filters.search || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    driveConfigId: folderFilter === 'all' ? undefined : folderFilter,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };

  const { data, isLoading } = useDocuments(queryParams);

  const allIds = data?.documents.map((d) => d.id) || [];
  const isAllSelected = allIds.length > 0 && allIds.every((id) => selection.isSelected(id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      selection.selectNone();
    } else {
      selection.selectAll(allIds);
    }
  };

  const selectedDocuments = data?.documents.filter((d) => selection.isSelected(d.id)) || [];

  return (
    <div className="space-y-4">


      {/* Filters */}
      <DocumentFilters
        filters={filters}
        onChange={(newFilters) => {
          setFilters(newFilters);
          setPage(1);
        }}
        counts={data?.counts}
      />

      {/* Drive Filter (additional) */}
      {configData?.configs && configData.configs.length > 0 && (
        <div className="flex items-center gap-2">
          <FolderSync className="w-4 h-4 text-gray-400" />
          <Select
            value={folderFilter}
            onChange={(val: string | number) => {
              setFolderFilter(String(val));
              setPage(1);
            }}
            options={[
              { label: 'All Folders', value: 'all' },
              ...(configData.configs.map((config) => ({
                label: config.folderName,
                value: config.id
              })))
            ]}
            className="w-[200px]"
          />
        </div>
      )}

      {/* Status Counts Summary */}
      {data?.counts && (
        <div className="flex gap-4 text-xs text-gray-500">
          <span>Total: {data.total}</span>
          <span className="text-green-600">Active: {data.counts.active}</span>
          <span className="text-yellow-600">Inactive: {data.counts.inactive}</span>
          <span className="text-red-600">Failed: {data.counts.failed}</span>
        </div>
      )}

      {/* Select All */}
      {data && data.documents.length > 0 && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={handleSelectAll}
            className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
          />
          <span className="text-sm text-gray-600">
            Select all ({data.documents.length})
          </span>
        </div>
      )}

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
            <DocumentCard
              key={doc.id}
              document={doc}
              isSelected={selection.isSelected(doc.id)}
              onSelect={() => selection.toggle(doc.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > 0 && (
        <Pagination
          total={data.total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedIds={Array.from(selection.selected)}
        selectedDocuments={selectedDocuments}
        onClear={selection.selectNone}
        onDeleteConfirm={() => setShowDeleteModal(true)}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        documents={selectedDocuments}
        onSuccess={selection.selectNone}
      />
    </div>
  );
}
