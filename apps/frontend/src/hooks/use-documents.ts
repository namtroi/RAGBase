import { documentsApi } from '@/api/endpoints';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useDocuments(params?: {
  status?: string;
  limit?: number;
  offset?: number;
  driveConfigId?: string;
}) {
  // SSE handles real-time updates via EventProvider
  return useQuery({
    queryKey: ['documents', params],
    queryFn: () => documentsApi.list(params),
  });
}

export function useDocument(id: string) {
  // SSE handles real-time updates via EventProvider
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => documentsApi.get(id),
    enabled: !!id,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => documentsApi.upload(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
