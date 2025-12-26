import { documentsApi } from '@/api/endpoints';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertCircle, CheckCircle, Clock, Loader2, Upload, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

const ACCEPTED_FORMATS = {
  'application/pdf': ['.pdf'],
  'application/json': ['.json'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/html': ['.html', '.htm'],
  'application/epub+zip': ['.epub'],
};

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 20;
const MAX_CONCURRENT = 3;

interface UploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

// Upload Status Popup Component
function UploadStatusPopup({
  items,
  onClose
}: {
  items: UploadItem[];
  onClose: () => void;
}) {
  const stats = {
    total: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    uploading: items.filter(i => i.status === 'uploading').length,
    success: items.filter(i => i.status === 'success').length,
    error: items.filter(i => i.status === 'error').length,
  };

  const isComplete = stats.pending === 0 && stats.uploading === 0;

  // Handle click outside to close (only when complete)
  const handleBackdropClick = () => {
    if (isComplete) {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop - clickable when complete */}
      {isComplete && (
        <div
          className="fixed inset-0 z-40"
          onClick={handleBackdropClick}
        />
      )}

      <div className="fixed bottom-4 right-4 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            {!isComplete ? (
              <>
                <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
                <span className="font-medium text-gray-700">
                  Uploading {stats.uploading + stats.success}/{stats.total}...
                </span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="font-medium text-gray-700">Upload Complete</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* File list */}
        <div className="max-h-64 overflow-auto">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 last:border-0">
              {item.status === 'pending' && <Clock className="w-4 h-4 text-gray-400 shrink-0" />}
              {item.status === 'uploading' && <Loader2 className="w-4 h-4 text-primary-500 animate-spin shrink-0" />}
              {item.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
              {item.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}

              <span className={clsx(
                'flex-1 text-sm truncate',
                item.status === 'error' ? 'text-red-600' : 'text-gray-700'
              )}>
                {item.file.name}
              </span>

              {item.status === 'error' && (
                <span className="text-xs text-red-500 truncate max-w-24" title={item.error}>
                  {item.error}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Footer - Summary */}
        {isComplete && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                ✅ {stats.success} uploaded
                {stats.error > 0 && <span className="text-red-500 ml-2">• ❌ {stats.error} failed</span>}
              </span>
              <span className="text-xs text-gray-400">
                Click anywhere to close
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function UploadDropzone() {
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const queryClient = useQueryClient();

  // Update single item status
  const updateItem = useCallback((id: string, updates: Partial<UploadItem>) => {
    setUploadItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  // Upload single file
  const uploadFile = useCallback(async (item: UploadItem) => {
    updateItem(item.id, { status: 'uploading' });
    try {
      await documentsApi.upload(item.file);
      updateItem(item.id, { status: 'success' });
    } catch (error) {
      updateItem(item.id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed'
      });
    }
  }, [updateItem]);

  // Process queue with concurrency limit
  const processQueue = useCallback(async (items: UploadItem[]) => {
    const queue = [...items];
    const active: Promise<void>[] = [];

    const startNext = async () => {
      if (queue.length === 0) return;

      const item = queue.shift()!;
      const promise = uploadFile(item).finally(() => {
        const idx = active.indexOf(promise);
        if (idx > -1) active.splice(idx, 1);
      });
      active.push(promise);
    };

    // Initial batch
    for (let i = 0; i < Math.min(MAX_CONCURRENT, items.length); i++) {
      startNext();
    }

    // Process remaining
    while (queue.length > 0 || active.length > 0) {
      if (active.length > 0) {
        await Promise.race(active);
        if (queue.length > 0) {
          startNext();
        }
      }
    }

    // Done - refresh documents list
    await queryClient.invalidateQueries({ queryKey: ['documents'] });
  }, [uploadFile, queryClient]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      // Create upload items (limit to MAX_FILES)
      const filesToUpload = acceptedFiles.slice(0, MAX_FILES);
      const skippedFiles = acceptedFiles.slice(MAX_FILES);

      const newItems: UploadItem[] = [
        // Files to upload
        ...filesToUpload.map(file => ({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          status: 'pending' as const,
        })),
        // Skipped files (marked as error)
        ...skippedFiles.map(file => ({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          status: 'error' as const,
          error: `Skipped (max ${MAX_FILES} files)`,
        })),
      ];

      setUploadItems(newItems);
      setShowPopup(true);

      // Only process files within limit
      if (filesToUpload.length > 0) {
        processQueue(newItems.filter(i => i.status === 'pending'));
      }
    },
    [processQueue]
  );

  const handleClosePopup = useCallback(() => {
    setShowPopup(false);
    setUploadItems([]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FORMATS,
    maxSize: MAX_SIZE,
    multiple: true,
    disabled: showPopup,
  });

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400',
          showPopup && 'opacity-50 pointer-events-none'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        {isDragActive ? (
          <p className="text-primary-600 font-medium">Drop files here</p>
        ) : (
          <>
            <p className="text-gray-600 font-medium">
              Drag and drop files here, or click to select
            </p>
            <p className="text-sm text-gray-500 mt-2">
              PDF, DOCX, XLSX, CSV, PPTX, HTML, EPUB, JSON, TXT, MD (max {MAX_FILES} files, 50MB each)
            </p>
          </>
        )}
      </div>



      {/* Upload Status Popup */}
      {showPopup && uploadItems.length > 0 && (
        <UploadStatusPopup
          items={uploadItems}
          onClose={handleClosePopup}
        />
      )}
    </div>
  );
}
