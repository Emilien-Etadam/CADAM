import { getLocalDevUserId } from '@/lib/localAuth';

/**
 * Single local dev user when no session distinction is required.
 */
export function getEffectiveUserId(
  userId: string | undefined | null,
): string | null {
  if (userId) {
    return userId;
  }
  return getLocalDevUserId();
}
