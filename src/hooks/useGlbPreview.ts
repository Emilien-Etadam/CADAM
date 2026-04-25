import { useQuery } from '@tanstack/react-query';

export const useGlbPreview = ({ id }: { id?: string }) => {
  useQuery({
    queryKey: ['preview', id, 'local'],
    enabled: false,
    queryFn: async () => null,
  });
  return {
    data: null,
    updatedAt: null,
    isLoading: false,
    error: null,
  };
};
