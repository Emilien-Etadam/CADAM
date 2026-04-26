const STORAGE_KEY = 'cadam.localLlmModelId';
const STORAGE_BASE_URL_KEY = 'cadam.localApiBaseUrl';

export function getPersistedApiBaseUrlOverride(): string | undefined {
  if (typeof localStorage === 'undefined') {
    return undefined;
  }
  const v = localStorage.getItem(STORAGE_BASE_URL_KEY)?.trim();
  return v && v.length > 0 ? v : undefined;
}

export function setPersistedApiBaseUrlOverride(url: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  const t = url.trim();
  if (t.length > 0) {
    localStorage.setItem(STORAGE_BASE_URL_KEY, t);
  } else {
    localStorage.removeItem(STORAGE_BASE_URL_KEY);
  }
}

export function getPersistedLocalLlmModelId(): string | undefined {
  if (typeof localStorage === 'undefined') {
    return undefined;
  }
  const v = localStorage.getItem(STORAGE_KEY);
  return v && v.length > 0 ? v : undefined;
}

export function setPersistedLocalLlmModelId(id: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  if (id.length > 0) {
    localStorage.setItem(STORAGE_KEY, id);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}
