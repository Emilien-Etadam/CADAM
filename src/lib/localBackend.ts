import { getPersistedApiBaseUrlOverride } from '@/lib/localLlmSettings';

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
