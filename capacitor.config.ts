import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.estateflow.propertymanagement',
  appName: 'AXIVESTRA',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: { CapacitorHttp: { enabled: true } },
  server: { androidScheme: 'https' }
};

export default config;
