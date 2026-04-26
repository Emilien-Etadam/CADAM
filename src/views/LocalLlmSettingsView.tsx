import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ModelSelector } from '@/components/ModelSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getLocalApiModelsQueryKey,
  useLocalApiModels,
} from '@/hooks/useLocalApiModels';
import { getApiBaseUrl } from '@/lib/localBackend';
import { parametricModelConfigsFromApi } from '@/lib/localLlmModelConfigs';
import {
  getPersistedApiBaseUrlOverride,
  getPersistedLocalLlmModelId,
  setPersistedApiBaseUrlOverride,
  setPersistedLocalLlmModelId,
} from '@/lib/localLlmSettings';
import type { Model } from '@shared/types';
import { cn } from '@/lib/utils';

/**
 * Réglages locaux du LLM (URL d’API, modèle par défaut, disponibilité).
 * Réutilise useLocalApiModels et la persistance sans logique parallèle.
 */
export function LocalLlmSettingsView() {
  const queryClient = useQueryClient();
  const {
    data: apiModels,
    isLoading,
    isError,
    refetch,
    status,
  } = useLocalApiModels();

  const [baseInput, setBaseInput] = useState(() => {
    return getPersistedApiBaseUrlOverride() ?? '';
  });
  const [model, setModel] = useState<Model>(
    () => getPersistedLocalLlmModelId() ?? '',
  );

  const effectiveBase = getApiBaseUrl();

  const modelConfigs = useMemo(
    () => parametricModelConfigsFromApi(apiModels),
    [apiModels],
  );

  useEffect(() => {
    if (model) return;
    if (apiModels?.defaultModel) {
      setPersistedLocalLlmModelId(apiModels.defaultModel);
      setModel(apiModels.defaultModel);
    }
  }, [apiModels?.defaultModel, model]);

  const handleSaveBaseUrl = useCallback(() => {
    setPersistedApiBaseUrlOverride(baseInput);
    void queryClient.invalidateQueries({ queryKey: ['api', 'models'] });
    void refetch();
  }, [baseInput, queryClient, refetch]);

  const setModelWithPersist = useCallback((m: Model) => {
    setPersistedLocalLlmModelId(m);
    setModel(m);
  }, []);

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-8',
        'text-adam-text-primary',
      )}
    >
      <div>
        <h1 className="text-xl font-semibold">Local LLM</h1>
        <p className="mt-1 text-sm text-adam-text-tertiary">
          Configuration stockée dans ce navigateur (base d’API et modèle par
          défaut pour le mode paramétrique).
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <Label htmlFor="local-api-base">Base URL de l’API locale</Label>
        <p className="text-xs text-adam-text-tertiary">
          Laisser vide pour utiliser uniquement la variable d’environnement{' '}
          <code className="rounded bg-adam-neutral-900 px-1">
            VITE_API_BASE_URL
          </code>{' '}
          ou l’origine actuelle. Saisir une URL complète (sans slash final) pour
          forcer un autre hôte.
        </p>
        <Input
          id="local-api-base"
          type="url"
          placeholder="(env / same-origin)"
          value={baseInput}
          onChange={(e) => setBaseInput(e.target.value)}
          className="bg-adam-bg-secondary-dark"
        />
        <p className="text-xs text-adam-text-tertiary">
          Effectif actuel :{' '}
          <span className="font-mono text-adam-text-primary">
            {effectiveBase || '(same-origin)'}
          </span>
        </p>
        <Button type="button" variant="secondary" onClick={handleSaveBaseUrl}>
          Enregistrer l’URL
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <Label>Modèle par défaut</Label>
        <p className="text-xs text-adam-text-tertiary">
          Appliqué aux nouvelles discussions et aux relances si aucun modèle
          n’est déjà fixé sur le message.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ModelSelector
            models={modelConfigs}
            selectedModel={model}
            onModelChange={setModelWithPersist}
            disabled={isLoading}
            type="parametric"
            modelsLoading={isLoading}
          />
        </div>
      </section>

      <section className="rounded-lg border border-adam-neutral-700 bg-adam-bg-secondary-dark p-4">
        <h2 className="text-sm font-medium">Disponibilité des modèles</h2>
        <dl className="mt-2 space-y-1 text-sm text-adam-text-tertiary">
          <div className="flex justify-between gap-4">
            <dt>État</dt>
            <dd className="text-adam-text-primary">
              {isLoading && 'Chargement…'}
              {!isLoading && isError && 'Erreur (API injoignable)'}
              {!isLoading && !isError && status === 'success' && 'OK'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Modèles signalés</dt>
            <dd className="text-right font-mono text-adam-text-primary">
              {apiModels?.models?.length ?? 0}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Défaut serveur</dt>
            <dd className="max-w-[60%] truncate font-mono text-xs text-adam-text-primary">
              {apiModels?.defaultModel ?? '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Clé de cache</dt>
            <dd
              className="max-w-[60%] truncate font-mono text-xs text-adam-text-primary"
              title={getLocalApiModelsQueryKey().join(' / ')}
            >
              {JSON.stringify(getLocalApiModelsQueryKey())}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
