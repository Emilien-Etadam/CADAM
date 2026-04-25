/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute API base (trailing slashes stripped). Empty = same-origin /api (Vite proxy). */
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEV_USER_ID?: string;
  readonly VITE_DEV_USER_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
