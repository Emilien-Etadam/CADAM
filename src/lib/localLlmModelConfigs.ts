import type { ModelConfig } from '@/types/misc';

export type LocalApiModelsPayload = {
  defaultModel: string;
  models: { id: string }[];
};

export function parametricModelConfigsFromApi(
  api: LocalApiModelsPayload | undefined,
): ModelConfig[] {
  const rows = (api?.models ?? []).map((m) => ({
    id: m.id,
    name: m.id,
    description: '',
  }));
  if (rows.length === 0 && api?.defaultModel) {
    return [
      {
        id: api.defaultModel,
        name: api.defaultModel,
        description: '',
      },
    ];
  }
  return rows;
}
