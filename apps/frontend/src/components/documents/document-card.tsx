import { Document, documentsApi } from '@/api/endpoints';
import { Calendar, Download, FileText, FolderSync, Hash, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { StatusBadge } from './status-badge';

interface DocumentCardProps {
  document: Document;
}

export function DocumentCard({ document }: DocumentCardProps) {
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
      // alert('Failed to download content'); // Removed to avoid annoying alerts, log is enough
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <FileText className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-gray-900 truncate">{document.filename}</h3>
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" />
                <span className="font-mono">{document.id.slice(0, 8)}...</span>
              </span>
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
        <StatusBadge status={document.status} />
      </div>
      {document.failReason && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
          {document.failReason}
        </div>
      )}
    </div>
  );
}
