import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.renmito.app',
  appName: 'Renmito',
  // Vite outputs to dist/ (flat, unlike Angular's dist/.../browser/)
  webDir: 'dist',
  android: {
    // https scheme keeps localStorage + cookies correct on Android 12+
    useLegacyBridge: false,
  },
  server: {
    androidScheme: 'https',
    // Capacitor WebView → production API; cleartext not needed
    cleartext: false,
  },
  plugins: {
    LocalNotifications: {
      // White silhouette icon required by Android for notification shade
      smallIcon: 'ic_stat_notification',
      // Brand dark navy background tint for the notification icon
      iconColor: '#15173D',
    },
  },
};

export default config;
