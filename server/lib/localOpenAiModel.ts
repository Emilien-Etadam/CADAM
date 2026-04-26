/**
 * Local OpenAI-compatible (vLLM) configuration and model resolution.
 */

export const OPENAI_BASE_URL = (
  process.env.OPENAI_BASE_URL ?? 'http://192.168.30.121:8000/v1'
).replace(/\/$/, '');
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? 'changeme';
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? '/model';

export const CHAT_COMPLETIONS_URL = `${OPENAI_BASE_URL}/chat/completions`;
const MODELS_URL = `${OPENAI_BASE_URL}/models`;

let cachedIds: string[] | null = null;
let cacheAt = 0;
const CACHE_MS = 30_000;

/**
 * Fetches model ids from the local server, or [OPENAI_MODEL] on failure.
 * Result always includes OPENAI_MODEL in the allow-list used for resolution.
 */
export async function fetchOpenAiCompatibleModelIds(): Promise<string[]> {
  const now = Date.now();
  if (cachedIds && now - cacheAt < CACHE_MS) {
    return cachedIds;
  }
  let ids: string[] = [];
  try {
    const r = await fetch(MODELS_URL, {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    });
    if (!r.ok) {
      throw new Error(String(r.status));
    }
    const j = (await r.json()) as { data?: Array<{ id?: string }> };
    ids = (j.data ?? [])
      .map((e) => e.id)
      .filter((x): x is string => typeof x === 'string' && x.length > 0);
  } catch {
    ids = [];
  }
  if (ids.length === 0) {
    ids = [OPENAI_MODEL];
  }
  const merged = new Set(ids);
  merged.add(OPENAI_MODEL);
  cachedIds = [...merged];
  cacheAt = now;
  return cachedIds;
}

export async function resolveLocalLlmModel(requested: unknown): Promise<string> {
  const allowed = new Set(await fetchOpenAiCompatibleModelIds());
  if (typeof requested === 'string' && requested.length > 0 && allowed.has(requested)) {
    return requested;
  }
  return OPENAI_MODEL;
}

export async function getModelsListPayload(): Promise<{
  defaultModel: string;
  models: { id: string }[];
}> {
  const ids = await fetchOpenAiCompatibleModelIds();
  const models = [...new Set(ids)].sort().map((id) => ({ id }));
  return { defaultModel: OPENAI_MODEL, models };
}
