import { useMemo } from 'react';
import { buildLocalSession, buildLocalUser } from '@/lib/localAuth';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => {
    const user = buildLocalUser();
    const session = buildLocalSession();
    return { session, user, isLoading: false };
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
