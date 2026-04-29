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

/** Jeton Bearer extrait de l’en-tête HTTP « Authorization », si présent. */
export function bearerTokenFromAuthorizationHeader(
  authorization: string | undefined,
): string | undefined {
  if (!authorization) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  const t = m?.[1]?.trim();
  return t && t.length > 0 ? t : undefined;
}

/** Clé pour les appels OpenAI-compatibles : priorité au Bearer client, sinon env serveur. */
export function resolveOpenAiApiKey(
  authorizationHeader?: string | null,
): string {
  return (
    bearerTokenFromAuthorizationHeader(authorizationHeader ?? undefined) ??
    OPENAI_API_KEY
  );
}

let cachedIds: string[] | null = null;
let cacheAt = 0;
let cacheApiKey: string | null = null;
const CACHE_MS = 30_000;

/**
 * Fetches model ids from the local server, or [OPENAI_MODEL] on failure.
 * Result always includes OPENAI_MODEL in the allow-list used for resolution.
 */
export async function fetchOpenAiCompatibleModelIds(
  resolvedApiKey: string = OPENAI_API_KEY,
): Promise<string[]> {
  const now = Date.now();
  if (cachedIds && cacheApiKey === resolvedApiKey && now - cacheAt < CACHE_MS) {
    return cachedIds;
  }
  let ids: string[] = [];
  try {
    const r = await fetch(MODELS_URL, {
      headers: { Authorization: `Bearer ${resolvedApiKey}` },
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
  cacheApiKey = resolvedApiKey;
  cacheAt = now;
  return cachedIds;
}

export async function resolveLocalLlmModel(
  requested: unknown,
  authorizationHeader?: string | null,
): Promise<string> {
  const key = resolveOpenAiApiKey(authorizationHeader);
  const allowed = new Set(await fetchOpenAiCompatibleModelIds(key));
  if (
    typeof requested === 'string' &&
    requested.length > 0 &&
    allowed.has(requested)
  ) {
    return requested;
  }
  return OPENAI_MODEL;
}

export async function getModelsListPayload(
  authorizationHeader?: string | null,
): Promise<{
  defaultModel: string;
  models: { id: string }[];
}> {
  const key = resolveOpenAiApiKey(authorizationHeader);
  const ids = await fetchOpenAiCompatibleModelIds(key);
  const models = [...new Set(ids)].sort().map((id) => ({ id }));
  return { defaultModel: OPENAI_MODEL, models };
}
