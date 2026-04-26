import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/lib/localBackend';
import type { LocalApiModelsPayload } from '@/lib/localLlmModelConfigs';

export function useLocalApiModels() {
  return useQuery({
    queryKey: ['api', 'models'],
    queryFn: async () => {
      const r = await fetch(`${getApiBaseUrl()}/api/models`);
      if (!r.ok) {
        throw new Error('models');
      }
      return (await r.json()) as LocalApiModelsPayload;
    },
    staleTime: 60_000,
  });
}
