import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.decodingindology.studio',
  appName: 'Smart Studio',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
