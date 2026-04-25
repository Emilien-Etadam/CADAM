import { isLocalTextBackend } from './localBackend';

/**
 * In local text mode, use the configured synthetic user when unauthenticated.
 */
export function getEffectiveUserId(
  userId: string | undefined | null,
): string | null {
  if (isLocalTextBackend()) {
    return (
      import.meta.env.VITE_DEV_USER_ID ??
      '00000000-0000-0000-0000-000000000001'
    );
  }
  return userId ?? null;
}
