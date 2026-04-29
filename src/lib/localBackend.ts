import {
  getPersistedApiBaseUrlOverride,
  getPersistedOpenAiApiKey,
} from '@/lib/localLlmSettings';

/**
 * Base URL for the local API (empty = same-origin, Vite proxy /api -> server).
 * A user override in local storage takes precedence over VITE_API_BASE_URL.
 */
export function getApiBaseUrl(): string {
  const o = getPersistedApiBaseUrlOverride();
  if (o) {
    return o.replace(/\/$/, '');
  }
  const u = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
  return u.replace(/\/$/, '');
}

/**
 * En-tête Authorization pour les routes LLM locales lorsque l’utilisateur a
 * saisi une clé dans les réglages (sinon le serveur utilise OPENAI_API_KEY).
 */
export function getLocalOpenAiAuthHeaders(): Record<string, string> {
  const k = getPersistedOpenAiApiKey()?.trim();
  if (!k) return {};
  return { Authorization: `Bearer ${k}` };
}
