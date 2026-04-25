import { useCallback } from 'react';

export function useRequestCancellation() {
  const cancelRequest = useCallback(async (_messageId: string) => {
    // No remote cancellation channel in local-only build
  }, []);
  return { cancelRequest };
}
