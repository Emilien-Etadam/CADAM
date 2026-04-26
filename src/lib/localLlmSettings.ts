const STORAGE_KEY = 'cadam.localLlmModelId';

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
