import { Document, documentsApi } from '@/api/endpoints';
import clsx from 'clsx';
import { Calendar, Download, ExternalLink, FileText, FolderSync, HardDrive, Hash, Link2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { AvailabilityToggle } from './availability-toggle';
import { StatusBadge } from './status-badge';

interface DocumentCardProps {
  document: Document;
  isSelected?: boolean;
  onSelect?: () => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentCard({ document, isSelected, onSelect }: DocumentCardProps) {
  const [downloading, setDownloading] = useState<'markdown' | 'json' | null>(null);

  const handleDownload = async (format: 'markdown' | 'json') => {
    try {
      setDownloading(format);
      const blob = await documentsApi.downloadContent(document.id, format);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document.filename.split('.')[0]}_processed.${format === 'json' ? 'json' : 'md'}`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed', err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div
      className={clsx(
        'bg-white border rounded-lg p-4 hover:shadow-md transition-shadow',
        isSelected ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-200'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Selection checkbox */}
          {onSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onSelect}
              className="w-4 h-4 mt-1 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
            />
          )}
          <FileText className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-gray-900 truncate">{document.filename}</h3>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" />
                <span className="font-mono">{document.id.slice(0, 8)}...</span>
              </span>
              {document.fileSize && (
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {formatFileSize(document.fileSize)}
                </span>
              )}
              {document.chunkCount !== undefined && (
                <span>{document.chunkCount} chunks</span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(document.createdAt).toLocaleDateString()}
              </span>
              {document.sourceType === 'DRIVE' && (
                <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  <FolderSync className="w-3 h-3" />
                  Drive
                  {document.driveWebViewLink && (
                    <a
                      href={document.driveWebViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="ml-1 hover:text-blue-800 transition-colors"
                      title="Open in Google Drive"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </span>
              )}
              {document.connectionState === 'LINKED' && (
                <span className="flex items-center gap-1 text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                  <Link2 className="w-3 h-3" />
                  Linked
                </span>
              )}
            </div>
            {document.hasProcessedContent && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleDownload('markdown')}
                  disabled={!!downloading}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                >
                  {downloading === 'markdown' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  Markdown
                </button>
                <button
                  onClick={() => handleDownload('json')}
                  disabled={!!downloading}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                >
                  {downloading === 'json' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  JSON
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Availability Toggle - only for COMPLETED docs */}
          {document.status === 'COMPLETED' && document.isActive !== undefined && (
            <AvailabilityToggle
              documentId={document.id}
              isActive={document.isActive}
              disabled={document.status !== 'COMPLETED'}
            />
          )}
          <StatusBadge status={document.status} />
        </div>
      </div>
      {document.failReason && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
          {document.failReason}
        </div>
      )}
    </div>
  );
}
