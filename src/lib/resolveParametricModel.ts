import type { LocalApiModelsPayload } from '@/lib/localLlmModelConfigs';
import { getPersistedLocalLlmModelId } from '@/lib/localLlmSettings';
import type { Content, Conversation } from '@shared/types';
import type { Model } from '@shared/types';

/**
 * Résout le modèle paramétrique côté client : contenu de message (si fourni),
 * réglage de conversation, persistance locale, défaut API, chaîne vide.
 */
export function resolveParametricModel(input: {
  content?: Content | null;
  conversation: Pick<Conversation, 'settings'>;
  apiModels?: LocalApiModelsPayload;
}): Model {
  const settingsModel =
    typeof input.conversation.settings === 'object' &&
    input.conversation.settings &&
    'model' in input.conversation.settings
      ? (input.conversation.settings as { model?: Model }).model
      : undefined;
  return (
    input.content?.model ??
    settingsModel ??
    getPersistedLocalLlmModelId() ??
    input.apiModels?.defaultModel ??
    ''
  );
}
