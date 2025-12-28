import { ProcessingProfile } from '@/api/endpoints';
import { useProfiles } from '@/hooks/use-profiles';
import { Plus, Sliders } from 'lucide-react';
import { useState } from 'react';
import { ProfileCard } from './ProfileCard';
import { ProfileFormDialog } from './ProfileFormDialog';
import { ProfileDeleteDialog } from './ProfileDeleteDialog';

interface DialogState {
  open: boolean;
  sourceProfile?: ProcessingProfile;
}

export function ProfilePage() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const { data: profiles, isLoading, error } = useProfiles(includeArchived);

  const [dialogState, setDialogState] = useState<DialogState>({ open: false });
  const [deleteProfile, setDeleteProfile] = useState<ProcessingProfile | null>(null);

  const handleCreate = () => {
    setDialogState({ open: true });
  };

  const handleDuplicate = (profile: ProcessingProfile) => {
    setDialogState({ open: true, sourceProfile: profile });
  };

  const handleCloseDialog = () => {
    setDialogState({ open: false });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-400 animate-pulse flex items-center gap-2">
          <Sliders className="w-5 h-5" /> Loading profiles...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4 bg-red-50 text-red-700 rounded-lg">
        Failed to load profiles. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-gray-400" />
            Processing Profiles
          </h2>
          <p className="text-sm text-gray-500">Configure how documents are converted, chunked, and embedded.</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Profile
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center justify-end">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Show archived profiles
        </label>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6">
        {profiles?.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            onDelete={(p) => setDeleteProfile(p)}
            onDuplicate={handleDuplicate}
          />
        ))}
      </div>

      {!profiles?.length && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Sliders className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-900">No profiles found</h3>
          <p className="text-sm text-gray-500 mt-1">Create a new profile to get started.</p>
        </div>
      )}

      {/* Dialogs */}
      <ProfileFormDialog
        open={dialogState.open}
        onClose={handleCloseDialog}
        sourceProfile={dialogState.sourceProfile}
      />

      {deleteProfile && (
        <ProfileDeleteDialog
          profile={deleteProfile}
          open={!!deleteProfile}
          onClose={() => setDeleteProfile(null)}
        />
      )}
    </div>
  );
}
