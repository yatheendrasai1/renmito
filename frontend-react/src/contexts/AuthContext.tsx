import {
  createContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import api, { registerLogoutCallback } from '@/lib/api';
import type { AuthUser } from '@/types';

// ── TokenSync — custom Capacitor plugin (syncs JWT to native storage for
//    Android widgets / background tasks). Same plugin used in Angular app.
interface TokenSyncPlugin {
  saveToken(options: { token: string }): Promise<void>;
  clearToken(): Promise<void>;
}
const TokenSync = registerPlugin<TokenSyncPlugin>('TokenSync');

// ── Storage keys (must match Angular app so sessions are shared) ──────────────
const TOKEN_KEY = 'renmito-token';
const USER_KEY  = 'renmito-user';

// ── Context shape ─────────────────────────────────────────────────────────────

export interface AuthState {
  user:            AuthUser | null;
  token:           string | null;
  isAuthenticated: boolean;
  login:           (email: string, password: string) => Promise<void>;
  signup:          (userName: string, email: string, password: string) => Promise<void>;
  logout:          () => void;
  changePassword:  (currentPassword: string, newPassword: string) => Promise<{ message: string }>;
}

// Context object is exported for useAuth (hooks/useAuth.ts) to consume.
// This is the standard React context pattern — the react-refresh rule does not
// apply here since AuthContext is not a component.
// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthState | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialise from localStorage so a page refresh doesn't flash the login screen
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser]   = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  const persist = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    if (Capacitor.isNativePlatform()) {
      TokenSync.saveToken({ token: newToken }).catch(() => {});
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    if (Capacitor.isNativePlatform()) {
      TokenSync.clearToken().catch(() => {});
    }
  }, []);

  // ── Auth operations ────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: AuthUser }>('/auth/login', { email, password });
    persist(res.data.token, res.data.user);
  }, [persist]);

  const signup = useCallback(async (userName: string, email: string, password: string) => {
    const res = await api.post<{ token: string; user: AuthUser }>('/auth/signup', { userName, email, password });
    persist(res.data.token, res.data.user);
  }, [persist]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const res = await api.post<{ message: string }>('/auth/change-password', { currentPassword, newPassword });
    return res.data;
  }, []);

  // Register logout with the Axios interceptor so 401 responses clear state
  useEffect(() => {
    registerLogoutCallback(logout);
  }, [logout]);

  // ── Context value ──────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token,
      login,
      signup,
      logout,
      changePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// useAuth hook lives in src/hooks/useAuth.ts
// (separated to keep this file component-only for React Fast Refresh / HMR)
