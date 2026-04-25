/**
 * Base URL for the local API (empty = same-origin, Vite proxy /api -> server).
 */
export function getApiBaseUrl(): string {
  const u = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
  return u.replace(/\/$/, '');
}
