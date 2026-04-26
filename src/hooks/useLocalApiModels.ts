import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/lib/localBackend';
import type { LocalApiModelsPayload } from '@/lib/localLlmModelConfigs';

/**
 * Inclut la base d’URL pour que le cache ne mélange pas les réponses
 * lors d’un changement d’hôte (réglage utilisateur).
 */
export function getLocalApiModelsQueryKey() {
  return ['api', 'models', getApiBaseUrl()] as const;
}

export function useLocalApiModels() {
  return useQuery({
    queryKey: getLocalApiModelsQueryKey(),
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
