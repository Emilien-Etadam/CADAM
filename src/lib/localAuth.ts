import type { LocalSession, LocalUser } from './authTypes';

const DEFAULT_LOCAL_USER_ID = '00000000-0000-0000-0000-000000000001';

export function getLocalDevUserId(): string {
  return import.meta.env.VITE_DEV_USER_ID ?? DEFAULT_LOCAL_USER_ID;
}

export function getLocalDevUserEmail(): string {
  return import.meta.env.VITE_DEV_USER_EMAIL ?? 'local@localhost';
}

export function buildLocalUser(): LocalUser {
  return {
    id: getLocalDevUserId(),
    email: getLocalDevUserEmail(),
  };
}

export function buildLocalSession(): LocalSession {
  return { user: buildLocalUser() };
}
