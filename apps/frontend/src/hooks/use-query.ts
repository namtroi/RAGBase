import { queryApi } from '@/api/endpoints';
import { useMutation } from '@tanstack/react-query';

export function useSearch() {
  return useMutation({
    mutationFn: ({ query, topK }: { query: string; topK?: number }) =>
      queryApi.search(query, topK),
  });
}
