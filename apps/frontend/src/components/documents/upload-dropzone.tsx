import { useUploadDocument } from '@/hooks/use-documents';
import clsx from 'clsx';
import { AlertCircle, CheckCircle, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

const ACCEPTED_FORMATS = {
  'application/pdf': ['.pdf'],
  'application/json': ['.json'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
};

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export function UploadDropzone() {
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const uploadMutation = useUploadDocument();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setUploadStatus({ type: null, message: '' });

      try {
        const result = await uploadMutation.mutateAsync(file);
        setUploadStatus({
          type: 'success',
          message: `Uploaded ${result.filename} - ${result.lane} lane`,
        });
      } catch (error: unknown) {
        setUploadStatus({
          type: 'error',
          message: error instanceof Error ? error.message : 'Upload failed',
        });
      }
    },
    [uploadMutation]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: ACCEPTED_FORMATS,
      maxSize: MAX_SIZE,
      multiple: false,
    });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400',
          uploadMutation.isPending && 'opacity-50 pointer-events-none'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        {isDragActive ? (
          <p className="text-primary-600 font-medium">Drop the file here</p>
        ) : (
          <>
            <p className="text-gray-600 font-medium">
              Drag and drop a file here, or click to select
            </p>
            <p className="text-sm text-gray-500 mt-2">
              PDF, JSON, TXT, MD (max 50MB)
            </p>
          </>
        )}
      </div>

      {/* Upload status */}
      {uploadStatus.type && (
        <div
          className={clsx(
            'flex items-center gap-2 p-3 rounded-lg',
            uploadStatus.type === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          )}
        >
          {uploadStatus.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{uploadStatus.message}</span>
        </div>
      )}

      {/* File rejections */}
      {fileRejections.length > 0 && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg">
          <p className="font-medium">File rejected:</p>
          {fileRejections.map(({ file, errors }) => (
            <p key={file.name} className="text-sm">
              {file.name}: {errors.map((e) => e.message).join(', ')}
            </p>
          ))}
        </div>
      )}

      {/* Loading state */}
      {uploadMutation.isPending && (
        <div className="flex items-center gap-2 text-gray-600">
          <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-primary-500 rounded-full" />
          <span>Uploading...</span>
        </div>
      )}
    </div>
  );
}
