import { useQuery } from '@tanstack/react-query';
import type { MeshData } from '@shared/types';

/** Local-only build: no cloud mesh pipeline. */
export const useMeshData = ({ id }: { id: string }) => {
  const dataQuery = useQuery<MeshData | null>({
    queryKey: ['meshData', id],
    enabled: false,
    queryFn: async () => null,
  });
  const blobQuery = useQuery<Blob | null>({
    queryKey: ['mesh', id],
    enabled: false,
    queryFn: async () => null,
  });
  return { data: dataQuery, blob: blobQuery };
};
