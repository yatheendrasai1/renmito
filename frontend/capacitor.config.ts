import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.renmito.app',
  appName: 'Renmito',
  // Angular application builder outputs to browser/ subfolder
  webDir: 'dist/renmito-frontend/browser',
  android: {
    // Use https scheme so localStorage and cookies behave correctly on Android 12+
    useLegacyBridge: false,
  },
  server: {
    androidScheme: 'https',
    // Allows the WebView to make requests to your production API
    // without being blocked by mixed-content restrictions
    cleartext: false,
  },
};

export default config;
