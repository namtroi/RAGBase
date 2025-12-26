import { queryApi, SearchParams } from '@/api/endpoints';
import { useMutation } from '@tanstack/react-query';

export function useSearch() {
  return useMutation({
    mutationFn: (params: SearchParams) => queryApi.search(params),
  });
}
