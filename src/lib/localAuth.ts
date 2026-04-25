import type { Session, User } from '@supabase/supabase-js';

/**
 * Synthetic local user id/email — match `DEV_USER_ID` / `DEV_USER_EMAIL` in `server/`.
 */
const DEFAULT_LOCAL_USER_ID = '00000000-0000-0000-0000-000000000001';

export function getLocalDevUserId(): string {
  return import.meta.env.VITE_DEV_USER_ID ?? DEFAULT_LOCAL_USER_ID;
}

export function getLocalDevUserEmail(): string {
  return import.meta.env.VITE_DEV_USER_EMAIL ?? 'local@localhost';
}

export function buildLocalUser(): User {
  return {
    id: getLocalDevUserId(),
    email: getLocalDevUserEmail(),
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as User;
}

const LOCAL_TOKEN = 'local-dev';

export function buildLocalSession(): Session {
  const user = buildLocalUser();
  return {
    access_token: LOCAL_TOKEN,
    token_type: 'bearer',
    expires_in: 60 * 60 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    refresh_token: 'local-refresh',
    user,
  } as Session;
}
