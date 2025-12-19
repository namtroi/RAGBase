import { Document } from '@/api/endpoints';
import { Calendar, FileText, Hash } from 'lucide-react';
import { StatusBadge } from './status-badge';

interface DocumentCardProps {
  document: Document;
}

export function DocumentCard({ document }: DocumentCardProps) {
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
            </div>
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
