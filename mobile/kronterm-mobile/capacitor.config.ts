import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.kronterm.mobile',
  appName: 'KronTerm',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
    },
  },
};

export default config;
