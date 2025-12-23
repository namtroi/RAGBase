import { documentsApi } from '@/api/endpoints';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useDocuments(params?: {
  status?: string;
  limit?: number;
  offset?: number;
  driveConfigId?: string;
}) {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: () => documentsApi.list(params),
    refetchInterval: (query) => {
      // Poll if any documents are processing
      const hasProcessing = query.state.data?.documents?.some(
        (d) => d.status === 'PENDING' || d.status === 'PROCESSING'
      );
      return hasProcessing ? 3000 : false; // Poll every 3s
    },
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => documentsApi.get(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PENDING' || status === 'PROCESSING' ? 2000 : false;
    },
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
