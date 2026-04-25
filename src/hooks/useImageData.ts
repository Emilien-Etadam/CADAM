import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Prompt } from '@shared/types';

/** Minimal row shape for UI components that still expect cloud image metadata. */
export type ImageDataRow = {
  id: string;
  status?: 'pending' | 'success' | 'failure';
  prompt?: Prompt;
  created_at?: string;
};

export type ImageUrlRow = {
  id: string;
  url: string;
};

/** Local-only: no image pipeline; queries stay disabled. */
export function useImageData(_id: string): {
  data: UseQueryResult<ImageDataRow | null, Error>;
  url: UseQueryResult<ImageUrlRow | null, Error>;
} {
  const dataQuery = useQuery<ImageDataRow | null, Error>({
    queryKey: ['imageData', 'disabled'],
    enabled: false,
    queryFn: async () => null,
  });
  const urlQuery = useQuery<ImageUrlRow | null, Error>({
    queryKey: ['image', 'disabled'],
    enabled: false,
    queryFn: async () => null,
  });
  return { data: dataQuery, url: urlQuery };
}

export function useImagesData(_ids: string[]) {
  const dataQueries = useQueries({
    queries: _ids.map((id) => ({
      queryKey: ['imageData', id, 'disabled'],
      enabled: false,
      queryFn: async (): Promise<ImageDataRow | null> => null,
    })),
  }) as UseQueryResult<ImageDataRow | null, Error>[];
  const urlQueries = useQueries({
    queries: _ids.map((id) => ({
      queryKey: ['image', id, 'disabled'],
      enabled: false,
      queryFn: async (): Promise<ImageUrlRow | null> => null,
    })),
  }) as UseQueryResult<ImageUrlRow | null, Error>[];
  return { data: dataQueries, url: urlQueries };
}
