import { createContext, useContext } from 'react';
import type { LocalSession, LocalUser } from '@/lib/authTypes';

interface AuthContextType {
  session: LocalSession | null;
  user: LocalUser | null;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
