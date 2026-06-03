/**
 * Typed environment config — single source of truth for all env values.
 *
 * Values come from Vite's .env files:
 *   .env            → development  (npm start)
 *   .env.production → production   (npm run build, Vercel)
 *   .env.mobile     → mobile       (npm run build:mobile, Capacitor)
 */
export const ENV = {
  production: import.meta.env.PROD,
  apiBase: import.meta.env.VITE_API_BASE ?? '/api',
} as const;
