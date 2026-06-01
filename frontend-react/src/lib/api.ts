import axios from 'axios';
import { ENV } from '@/config/env';

const TOKEN_KEY = 'renmito-token';
const USER_KEY  = 'renmito-user';

// ── 401 callback ─────────────────────────────────────────────────────────────
// AuthContext registers its logout function here so the interceptor can
// update React state on session expiry without a circular import.
type LogoutFn = () => void;

let _onUnauthorized: LogoutFn = () => {
  // Default fallback before AuthContext mounts: clear storage + hard-redirect.
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.replace('/login');
};

export const registerLogoutCallback = (fn: LogoutFn): void => {
  _onUnauthorized = fn;
};

// ── Axios instance ────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: ENV.apiBase,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT (skip public auth endpoints)
api.interceptors.request.use((config) => {
  const url = config.url ?? '';
  const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/signup');

  if (!isAuthEndpoint) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

// Response interceptor: surface 401 → trigger logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      _onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export default api;
