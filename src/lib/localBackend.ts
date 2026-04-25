export function isLocalTextBackend(): boolean {
  return import.meta.env.VITE_LOCAL_BACKEND === 'true';
}

export function getLocalBackendBaseUrl(): string {
  return import.meta.env.VITE_LOCAL_BACKEND_URL ?? 'http://127.0.0.1:8787';
}
