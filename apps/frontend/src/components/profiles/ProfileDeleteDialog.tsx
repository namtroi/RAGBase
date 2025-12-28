import { ProcessingProfile } from '@/api/endpoints';
import { useDeleteProfile } from '@/hooks/use-profiles';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface ProfileDeleteDialogProps {
  profile: ProcessingProfile;
  open: boolean;
  onClose: () => void;
}

export function ProfileDeleteDialog({ profile, open, onClose }: ProfileDeleteDialogProps) {
  const deleteMutation = useDeleteProfile();
  const [confirmStep, setConfirmStep] = useState<'initial' | 'verification' | 'final'>('initial');
  const [confirmName, setConfirmName] = useState('');
  const [deleteStats, setDeleteStats] = useState<{ documents: number; chunks: number } | null>(null);

  const handleDelete = async () => {
    try {
      if (confirmStep === 'initial') {
        // First call: Check if profile has attached data
        const result = await deleteMutation.mutateAsync({ id: profile.id, confirmed: false });
        
        if ('requireConfirmation' in result && result.requireConfirmation) {
          setDeleteStats({
            documents: result.documentCount,
            chunks: result.chunkCount,
          });
          setConfirmStep('verification');
        } else {
          // No attached data, deleted successfully
          onClose();
        }
      } else {
        // Second call: Confirm deletion with attached data
        await deleteMutation.mutateAsync({ id: profile.id, confirmed: true });
        onClose();
      }
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4 text-red-600">
          <div className="p-2 bg-red-100 rounded-full">
            <Trash2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold">Delete Profile</h2>
        </div>

        {confirmStep === 'initial' && (
          <div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete profile <strong>"{profile.name}"</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                {deleteMutation.isPending ? 'Checking...' : 'Delete'}
              </button>
            </div>
          </div>
        )}

        {confirmStep === 'verification' && deleteStats && (
          <div>
             <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-6 text-sm text-amber-800">
              <div className="flex items-center gap-2 font-semibold mb-2">
                <AlertTriangle className="w-4 h-4" />
                Wait! This profile contains data:
              </div>
              <ul className="list-disc list-inside space-y-1 ml-1 text-amber-700">
                <li>{deleteStats.documents} documents</li>
                <li>{deleteStats.chunks} chunks</li>
              </ul>
              <p className="mt-3 text-xs">
                Deleting this profile will <strong>permanently delete</strong> all these documents and their chunks.
              </p>
            </div>

            <p className="text-sm text-gray-600 mb-2">
              Type <strong>{profile.name}</strong> to confirm deletion:
            </p>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-6 focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder={profile.name}
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending || confirmName !== profile.name}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
