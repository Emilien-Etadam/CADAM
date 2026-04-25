import { getLocalDevUserId } from '@/lib/localAuth';
import { isLocalTextBackend } from './localBackend';

/**
 * In local text mode, use the configured synthetic user when unauthenticated.
 */
export function getEffectiveUserId(
  userId: string | undefined | null,
): string | null {
  if (isLocalTextBackend()) {
    return getLocalDevUserId();
  }
  return userId ?? null;
}
