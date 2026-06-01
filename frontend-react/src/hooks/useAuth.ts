import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import type { AuthState } from '@/contexts/AuthContext';

export type { AuthState };

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be called inside <AuthProvider>');
  return ctx;
}
