/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOCAL_BACKEND?: string;
  readonly VITE_LOCAL_BACKEND_URL?: string;
  readonly VITE_DEV_USER_ID?: string;
  readonly VITE_DEV_USER_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
