import { profilesApi, ProfileCreateData } from '@/api/endpoints';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useProfiles(includeArchived = false) {
  return useQuery({
    queryKey: ['profiles', { includeArchived }],
    queryFn: () => profilesApi.list(includeArchived),
  });
}

export function useActiveProfile() {
  return useQuery({
    queryKey: ['profiles', 'active'],
    queryFn: () => profilesApi.getActive(),
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProfileCreateData) => profilesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function useDuplicateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, newName }: { id: string; newName?: string }) =>
      profilesApi.duplicate(id, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function useActivateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => profilesApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function useArchiveProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => profilesApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function useUnarchiveProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => profilesApi.unarchive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, confirmed }: { id: string; confirmed?: boolean }) =>
      profilesApi.delete(id, confirmed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}
