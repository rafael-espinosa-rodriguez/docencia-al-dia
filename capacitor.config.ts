import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.docenciaaldia.profesor',
  appName: 'Docencia al Día',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
