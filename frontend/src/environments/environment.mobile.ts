// Used by the Android/iOS Capacitor build.
// The WebView runs on capacitor://localhost — it cannot use a relative '/api' path.
// Replace the URL below with your actual Vercel deployment URL.
export const environment = {
  production: true,
  apiBase: 'https://renmito.vercel.app/api'
};
